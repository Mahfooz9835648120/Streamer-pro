/**
 * Teleparty Room UI — Create, join, leave, and display room state.
 */
import { EventBus, EVENTS } from '../utils/eventBus.js';
import { getState, setState } from '../utils/state.js';
import { createRoom, joinRoom, leaveRoom, syncPlay, syncPause, syncSeek, syncState } from './client.js';
import { loadVideo, getVideoEl } from '../video/player.js';

export function initRoom() {
  const createBtn    = document.getElementById('create-room-btn');
  const joinBtn      = document.getElementById('join-room-btn');
  const leaveBtn     = document.getElementById('leave-room-btn');
  const copyBtn      = document.getElementById('copy-room-btn');
  const roomInput    = document.getElementById('room-id-input');
  const nameInput    = document.getElementById('party-name-input');
  const roomIdDisplay= document.getElementById('room-id-display');
  const partyCount   = document.getElementById('party-count');
  const createJoin   = document.getElementById('party-create-join');
  const activePanel  = document.getElementById('party-active');
  const identityEl   = ensureIdentityLabel(activePanel);

  // Create room
  createBtn?.addEventListener('click', async () => {
    const name = getValidatedName(nameInput, 'create');
    if (!name) return;
    setState('party.isHost', true);
    setState('party.userName', name);
    await createRoom(name);
  });

  // Join room
  joinBtn?.addEventListener('click', async () => {
    const name = getValidatedName(nameInput, 'join');
    if (!name) return;
    const id = roomInput?.value.trim().toUpperCase();
    if (!id) { EventBus.emit(EVENTS.TOAST, { msg: 'Enter a room ID' }); return; }
    setState('party.userName', name);
    await joinRoom(id, name);
  });

  // Leave room
  leaveBtn?.addEventListener('click', () => {
    leaveRoom();
    showCreateJoinUI();
    EventBus.emit(EVENTS.TOAST, { msg: 'Left the room' });
  });

  // Copy room ID
  copyBtn?.addEventListener('click', () => {
    const id = getState('party.roomId');
    if (id) {
      navigator.clipboard?.writeText(id).then(() => EventBus.emit(EVENTS.TOAST, { msg: '✓ Room ID copied!' }));
    }
  });

  // Room joined
  EventBus.on(EVENTS.PARTY_JOIN, (msg) => {
    if (roomIdDisplay) roomIdDisplay.textContent = msg.roomId;
    if (partyCount)    partyCount.textContent    = msg.members || 1;
    if (identityEl) identityEl.textContent = `You: ${getState('party.userName')}`;
    showActiveUI();
    EventBus.emit(EVENTS.TOAST, { msg: `✓ Joined room ${msg.roomId}` });
  });

  // Members update
  EventBus.on(EVENTS.PARTY_MEMBERS, (count) => {
    if (partyCount) partyCount.textContent = count;
  });
  EventBus.on(EVENTS.PARTY_HOST, ({ hostName }) => {
    const amHost = getState('party.isHost');
    EventBus.emit(EVENTS.TOAST, { msg: amHost ? 'You are now the room host.' : `${hostName || 'Host'} controls playback.` });
  });
  EventBus.on(EVENTS.PARTY_STATE, (state) => {
    applyHostState(state);
  });

  // Party leave
  EventBus.on(EVENTS.PARTY_LEAVE, () => { showCreateJoinUI(); });

  // ——— Sync video play/pause/seek to party ———
  EventBus.on(EVENTS.VIDEO_PLAY, () => {
    if (getState('party.roomId') && !getState('party.isSyncing') && getState('party.isHost')) syncPlay();
  });
  EventBus.on(EVENTS.VIDEO_PAUSE, () => {
    if (getState('party.roomId') && !getState('party.isSyncing') && getState('party.isHost')) syncPause();
  });
  EventBus.on(EVENTS.VIDEO_SEEK, ({ time }) => {
    if (getState('party.roomId') && !getState('party.isSyncing') && getState('party.isHost')) syncSeek(time);
  });
  EventBus.on(EVENTS.VIDEO_SOURCE, ({ src, title }) => {
    if (getState('party.roomId') && !getState('party.isSyncing') && getState('party.isHost')) {
      const video = getVideoEl();
      syncState({
        src,
        title,
        time: video?.currentTime || 0,
        isPlaying: !video?.paused,
      });
    }
  });

  function showActiveUI() {
    if (createJoin) createJoin.style.display = 'none';
    if (activePanel) activePanel.style.display = '';
  }
  function showCreateJoinUI() {
    if (createJoin) createJoin.style.display = '';
    if (activePanel) activePanel.style.display = 'none';
    setState('party.roomId', null);
    setState('party.members', 0);
    setState('party.hostId', null);
    setState('party.isHost', false);
  }
}

function ensureIdentityLabel(activePanel) {
  if (!activePanel) return null;
  let el = document.getElementById('party-identity');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'party-identity';
  el.className = 'party-members';
  activePanel.prepend(el);
  return el;
}

function getValidatedName(nameInput, action = 'continue') {
  const name = nameInput?.value?.trim();
  if (!name) {
    EventBus.emit(EVENTS.TOAST, { msg: `Name is required to ${action} a room.` });
    return '';
  }
  return name.slice(0, 24);
}

async function applyHostState(state) {
  if (!state?.src || getState('party.isHost')) return;
  setState('party.isSyncing', true);
  try {
    await loadVideo({ src: state.src, title: state.title || 'Untitled' });
    const video = getVideoEl();
    if (video) video.currentTime = state.time || 0;
    if (state.isPlaying) await video?.play?.().catch(() => {});
    else video?.pause?.();
  } finally {
    setTimeout(() => setState('party.isSyncing', false), 250);
  }
}
