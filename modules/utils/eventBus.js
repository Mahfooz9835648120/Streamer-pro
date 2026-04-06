/**
 * EventBus — Central event system for inter-module communication.
 * Modules never import each other directly; they emit/listen via the bus.
 */
const listeners = new Map();

export const EventBus = {
  /** Subscribe to an event */
  on(event, handler) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(handler);
    // Return unsubscribe function
    return () => this.off(event, handler);
  },

  /** Subscribe once, auto-unsubscribes after first call */
  once(event, handler) {
    const wrapper = (data) => { handler(data); this.off(event, wrapper); };
    return this.on(event, wrapper);
  },

  /** Unsubscribe a handler */
  off(event, handler) {
    listeners.get(event)?.delete(handler);
  },

  /** Emit an event with optional payload */
  emit(event, data) {
    listeners.get(event)?.forEach(fn => {
      try { fn(data); } catch (e) { console.error(`[EventBus] Error in "${event}" handler:`, e); }
    });
  },
};

// Defined event names — used as constants to avoid typos
export const EVENTS = {
  // Playback
  VIDEO_PLAY:    'video:play',
  VIDEO_PAUSE:   'video:pause',
  VIDEO_SEEK:    'video:seek',
  VIDEO_ENDED:   'video:ended',
  VIDEO_LOADED:  'video:loaded',
  VIDEO_TIME:    'video:time',
  VIDEO_BUFFER:  'video:buffer',
  VIDEO_ERROR:   'video:error',
  VIDEO_SOURCE:  'video:source',

  // Music
  MUSIC_PLAY:    'music:play',
  MUSIC_PAUSE:   'music:pause',
  MUSIC_SEEK:    'music:seek',
  MUSIC_TRACK:   'music:track',
  MUSIC_ENDED:   'music:ended',
  MUSIC_FREQ:    'music:frequency', // audio frequency data for orb

  // Teleparty sync
  PARTY_PLAY:    'party:play',
  PARTY_PAUSE:   'party:pause',
  PARTY_SEEK:    'party:seek',
  PARTY_CHAT:    'party:chat',
  PARTY_JOIN:    'party:join',
  PARTY_LEAVE:   'party:leave',
  PARTY_MEMBERS: 'party:members',
  PARTY_HOST:    'party:host',
  PARTY_STATE:   'party:state',

  // UI
  MODE_CHANGE:   'ui:modeChange',
  TOAST:         'ui:toast',
  PANEL_OPEN:    'ui:panelOpen',
  PANEL_CLOSE:   'ui:panelClose',

  // Engine
  ENGINE_CHUNK:  'engine:chunk',
  ENGINE_READY:  'engine:ready',
};
