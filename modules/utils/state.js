/**
 * Central state store — single source of truth.
 * All modules read from here; they mutate via setState().
 */
import { EventBus } from './eventBus.js';

const _state = {
  // Current mode
  mode: 'video', // 'video' | 'music'

  // Video player
  video: {
    src: null,
    title: 'Select a video to play',
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    buffered: 0,
    volume: 1,
    muted: false,
    quality: 'AUTO',
    isHLS: false,
    isChunked: false,
  },

  // Music player
  music: {
    currentIndex: 0,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.8,
    shuffle: false,
    repeat: false, // false | 'all' | 'one'
  },

  // Teleparty
  party: {
    connected: false,
    roomId: null,
    userId: null,
    userName: '',
    hostId: null,
    members: 0,
    isHost: false,
    isSyncing: false,
  },

  // Performance
  perf: {
    isLowEnd: false,
    concurrency: navigator.hardwareConcurrency || 2,
  },

  // PiP
  pip: {
    active: false,
  },

  // History (loaded from localStorage)
  history: [],
};

/** Deep-get nested state value */
export function getState(path) {
  if (!path) return _state;
  return path.split('.').reduce((obj, key) => obj?.[key], _state);
}

/** Update state and optionally emit event */
export function setState(path, value, eventName = null) {
  const keys = path.split('.');
  let obj = _state;
  for (let i = 0; i < keys.length - 1; i++) {
    obj = obj[keys[i]];
    if (!obj) return;
  }
  obj[keys[keys.length - 1]] = value;

  if (eventName) EventBus.emit(eventName, value);
}

/** Initialize history from localStorage */
export function loadHistory() {
  try {
    const stored = localStorage.getItem('sp_history');
    _state.history = stored ? JSON.parse(stored) : [];
  } catch { _state.history = []; }
}

/** Save history to localStorage */
export function saveHistory() {
  try {
    localStorage.setItem('sp_history', JSON.stringify(_state.history.slice(0, 50)));
  } catch {}
}

/** Add/update item in watch history */
export function addToHistory(item) {
  const idx = _state.history.findIndex(h => h.src === item.src);
  const entry = { ...item, visitedAt: Date.now() };

  if (idx !== -1) {
    _state.history[idx] = { ..._state.history[idx], ...entry };
  } else {
    _state.history.unshift(entry);
  }
  if (_state.history.length > 50) _state.history = _state.history.slice(0, 50);
  saveHistory();
}

/** Clear all watch history */
export function clearHistory() {
  _state.history = [];
  saveHistory();
}
