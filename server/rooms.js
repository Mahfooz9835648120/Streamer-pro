/**
 * Room Manager — in-memory room storage.
 * Each room has an ID, a host, playback state, and a Map of userId → WebSocket.
 */

// Re-implement genId locally since server can't use browser modules easily
function makeId(len = 6) {
  return Math.random().toString(36).slice(2, 2 + len).toUpperCase();
}

export class RoomManager {
  constructor() {
    /** @type {Map<string, { id: string, hostId: string, members: Map<string, WebSocket>, names: Map<string, string>, playback: {src: string|null, title: string, time: number, isPlaying: boolean}, createdAt: number }>} */
    this.rooms = new Map();

    // Cleanup stale rooms every 5 minutes
    setInterval(() => this._cleanup(), 5 * 60 * 1000);
  }

  create(userId, userName, ws) {
    const id = makeId(6);
    const room = {
      id,
      hostId: userId,
      members: new Map([[userId, ws]]),
      names: new Map([[userId, userName || 'Guest']]),
      playback: { src: null, title: '', time: 0, isPlaying: false },
      createdAt: Date.now(),
    };
    this.rooms.set(id, room);
    return room;
  }

  get(roomId) {
    return this.rooms.get(roomId) || null;
  }

  join(roomId, userId, userName, ws) {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    room.members.set(userId, ws);
    room.names.set(userId, userName || 'Guest');
    return true;
  }

  leave(roomId, userId) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.members.delete(userId);
    room.names.delete(userId);
    if (room.hostId === userId) {
      room.hostId = room.members.keys().next().value || null;
    }
    if (room.members.size === 0) this.rooms.delete(roomId);
  }

  delete(roomId) {
    this.rooms.delete(roomId);
  }

  list() {
    return Array.from(this.rooms.values()).map(r => ({
      id: r.id,
      members: r.members.size,
      createdAt: r.createdAt,
    }));
  }

  _cleanup() {
    const now = Date.now();
    const maxAge = 2 * 60 * 60 * 1000; // 2 hours
    this.rooms.forEach((room, id) => {
      if (room.members.size === 0 || now - room.createdAt > maxAge) {
        this.rooms.delete(id);
      }
    });
  }
}
