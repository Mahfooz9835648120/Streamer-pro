/**
 * WebSocket handler — manages connections and routes messages.
 */
import { WebSocketServer } from 'ws';
import { RoomManager } from './rooms.js';

const rooms = new RoomManager();

export function initSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    console.log(`[WS] Client connected from ${req.socket.remoteAddress}`);
    let currentUserId = null;
    let currentRoomId = null;

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      const { type, userId, roomId } = msg;
      currentUserId = userId || currentUserId;

      switch (type) {
        case 'room:create': {
          if (!msg.userName?.trim()) {
            send(ws, { type: 'error', message: 'Name is required to create a room' });
            return;
          }
          const room = rooms.create(userId, msg.userName.trim(), ws);
          currentRoomId = room.id;
          send(ws, { type: 'room:created', roomId: room.id, members: 1, hostId: room.hostId, hostName: room.names.get(room.hostId) });
          console.log(`[WS] Room created: ${room.id} by ${userId}`);
          break;
        }

        case 'room:join': {
          if (!msg.userName?.trim()) {
            send(ws, { type: 'error', message: 'Name is required to join a room' });
            return;
          }
          const room = rooms.get(roomId?.toUpperCase());
          if (!room) {
            send(ws, { type: 'error', message: `Room "${roomId}" not found` });
            return;
          }
          rooms.join(room.id, userId, msg.userName.trim(), ws);
          currentRoomId = room.id;
          send(ws, { type: 'room:joined', roomId: room.id, members: room.members.size, hostId: room.hostId, hostName: room.names.get(room.hostId) });
          if (room.playback?.src) send(ws, { type: 'sync:state', state: room.playback });
          broadcast(room, { type: 'room:members', count: room.members.size }, ws);
          broadcastSystem(room, `${msg.userName.trim()} joined`, ws);
          console.log(`[WS] ${userId} joined room ${room.id}`);
          break;
        }

        case 'room:leave': {
          handleLeave(ws, currentRoomId, currentUserId);
          currentRoomId = null;
          break;
        }

        case 'sync:play':
        case 'sync:pause': {
          const room = rooms.get(currentRoomId);
          if (!room) break;
          if (room.hostId !== userId) {
            send(ws, { type: 'error', message: 'Only host can control playback' });
            break;
          }
          room.playback.isPlaying = type === 'sync:play';
          broadcast(room, { type, userId }, ws);
          break;
        }

        case 'sync:seek': {
          const room = rooms.get(currentRoomId);
          if (!room) break;
          if (room.hostId !== userId) {
            send(ws, { type: 'error', message: 'Only host can control playback' });
            break;
          }
          room.playback.time = Number(msg.time) || 0;
          broadcast(room, { type: 'sync:seek', time: msg.time, userId }, ws);
          break;
        }

        case 'sync:state': {
          const room = rooms.get(currentRoomId);
          if (!room) break;
          if (room.hostId !== userId) {
            send(ws, { type: 'error', message: 'Only host can control playback' });
            break;
          }
          room.playback = {
            src: msg.state?.src || null,
            title: msg.state?.title || '',
            time: Number(msg.state?.time) || 0,
            isPlaying: !!msg.state?.isPlaying,
          };
          broadcast(room, { type: 'sync:state', state: room.playback }, ws);
          break;
        }

        case 'chat:message': {
          const room = rooms.get(currentRoomId);
          if (room && msg.text?.trim()) {
            const payload = { type: 'chat:message', user: userId, name: room.names.get(userId) || msg.userName || 'Guest', text: msg.text.slice(0, 300) };
            broadcast(room, payload, null); // include sender too
          }
          break;
        }
      }
    });

    ws.on('close', () => {
      console.log(`[WS] Client disconnected: ${currentUserId}`);
      handleLeave(ws, currentRoomId, currentUserId);
    });

    ws.on('error', (err) => {
      console.warn(`[WS] Error for ${currentUserId}:`, err.message);
    });
  });

  console.log('[WS] WebSocket server initialized at /ws');
}

function send(ws, data) {
  if (ws.readyState === 1) ws.send(JSON.stringify(data));
}

function broadcast(room, data, excludeWs) {
  room.members.forEach((ws) => {
    if (ws !== excludeWs && ws.readyState === 1) {
      ws.send(JSON.stringify(data));
    }
  });
}

function broadcastSystem(room, text, excludeWs) {
  broadcast(room, { type: 'chat:message', system: true, text }, excludeWs);
}

function handleLeave(ws, roomId, userId) {
  if (!roomId) return;
  const room = rooms.get(roomId);
  if (!room) return;

  const leavingName = room.names.get(userId) || 'A user';
  rooms.leave(roomId, userId);

  if (room.members.size === 0) {
    rooms.delete(roomId);
    console.log(`[WS] Room ${roomId} deleted (empty)`);
  } else {
    broadcast(room, { type: 'room:members', count: room.members.size }, null);
    broadcast(room, { type: 'room:host', hostId: room.hostId, hostName: room.names.get(room.hostId) || 'Host' }, null);
    broadcastSystem(room, `${leavingName} left`, null);
  }

  send(ws, { type: 'room:left', roomId });
}
