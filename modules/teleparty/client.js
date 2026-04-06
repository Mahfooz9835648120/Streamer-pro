/**
 * Teleparty Client — WebSocket connection management.
 * Connects to the backend WS server and handles reconnect.
 */
import { EventBus, EVENTS } from '../utils/eventBus.js';
import { getState, setState } from '../utils/state.js';
import { genId } from '../utils/format.js';

let ws = null;
let userId = null;
let reconnectTimer = null;
let currentRoomId = null;

export function initTelepartyClient() {
  userId = genId(8);
  setState('party.userId', userId);
}

function getWsUrl() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  // In dev, proxy routes /ws to backend; in prod same origin
  return `${proto}//${location.host}/ws`;
}

function connect() {
  return new Promise((resolve, reject) => {
    try {
      ws = new WebSocket(getWsUrl());

      ws.onopen = () => {
        console.log('[Teleparty] Connected');
        setState('party.connected', true);
        resolve(ws);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleMessage(msg);
        } catch {}
      };

      ws.onclose = () => {
        setState('party.connected', false);
        // Auto-reconnect if in a room
        if (currentRoomId) {
          reconnectTimer = setTimeout(() => connect().then(() => {
            if (currentRoomId) joinRoom(currentRoomId);
          }), 3000);
        }
      };

      ws.onerror = (err) => {
        console.warn('[Teleparty] WS error:', err);
        reject(err);
      };
    } catch (err) {
      reject(err);
    }
  });
}

function handleMessage(msg) {
  switch (msg.type) {
    case 'room:created':
    case 'room:joined':
      currentRoomId = msg.roomId;
      setState('party.roomId', msg.roomId);
      setState('party.members', msg.members);
      setState('party.hostId', msg.hostId || null);
      setState('party.isHost', msg.hostId === getState('party.userId'));
      EventBus.emit(EVENTS.PARTY_JOIN, msg);
      break;

    case 'room:members':
      setState('party.members', msg.count);
      EventBus.emit(EVENTS.PARTY_MEMBERS, msg.count);
      break;

    case 'room:host':
      setState('party.hostId', msg.hostId || null);
      setState('party.isHost', msg.hostId === getState('party.userId'));
      EventBus.emit(EVENTS.PARTY_HOST, msg);
      break;

    case 'sync:play':
      setState('party.isSyncing', true);
      EventBus.emit(EVENTS.PARTY_PLAY, {});
      setTimeout(() => setState('party.isSyncing', false), 200);
      break;

    case 'sync:pause':
      setState('party.isSyncing', true);
      EventBus.emit(EVENTS.PARTY_PAUSE, {});
      setTimeout(() => setState('party.isSyncing', false), 200);
      break;

    case 'sync:seek':
      setState('party.isSyncing', true);
      EventBus.emit(EVENTS.PARTY_SEEK, { time: msg.time });
      setTimeout(() => setState('party.isSyncing', false), 200);
      break;

    case 'sync:state':
      EventBus.emit(EVENTS.PARTY_STATE, msg.state || null);
      break;

    case 'chat:message':
      EventBus.emit(EVENTS.PARTY_CHAT, { user: msg.user, name: msg.name, text: msg.text, system: msg.system });
      break;

    case 'room:left':
      currentRoomId = null;
      setState('party.roomId', null);
      setState('party.connected', false);
      EventBus.emit(EVENTS.PARTY_LEAVE, {});
      break;

    case 'error':
      EventBus.emit(EVENTS.TOAST, { msg: `⚠ ${msg.message}` });
      break;
  }
}

function send(msg) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ ...msg, userId, userName: getState('party.userName') || 'Guest' }));
  }
}

export async function createRoom(userName) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    try { await connect(); } catch { EventBus.emit(EVENTS.TOAST, { msg: '⚠ Cannot connect to server' }); return; }
  }
  if (userName) setState('party.userName', userName);
  send({ type: 'room:create' });
}

export async function joinRoom(roomId, userName) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    try { await connect(); } catch { EventBus.emit(EVENTS.TOAST, { msg: '⚠ Cannot connect to server' }); return; }
  }
  if (userName) setState('party.userName', userName);
  currentRoomId = roomId;
  send({ type: 'room:join', roomId });
}

export function leaveRoom() {
  send({ type: 'room:leave', roomId: currentRoomId });
  currentRoomId = null;
  setState('party.roomId', null);
  setState('party.members', 0);
  setState('party.isHost', false);
}

export function syncPlay()       { if (!getState('party.isSyncing')) send({ type: 'sync:play', roomId: currentRoomId }); }
export function syncPause()      { if (!getState('party.isSyncing')) send({ type: 'sync:pause', roomId: currentRoomId }); }
export function syncSeek(time)   { if (!getState('party.isSyncing')) send({ type: 'sync:seek', roomId: currentRoomId, time }); }
export function sendChatMsg(text){ send({ type: 'chat:message', roomId: currentRoomId, text }); }
export function syncState(state) { if (!getState('party.isSyncing')) send({ type: 'sync:state', roomId: currentRoomId, state }); }
