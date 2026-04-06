/**
 * Music Player — Audio playback, playlist management, AudioContext setup.
 */
import { EventBus, EVENTS } from '../utils/eventBus.js';
import { getState, setState } from '../utils/state.js';
import { formatTime } from '../utils/format.js';
import { initVisualizer } from './visualizer.js';
import { playlist } from './playlist.js';

const audio = document.getElementById('main-audio');
let audioCtx = null;
let analyser = null;
let sourceNode = null;
let freqTimer = null;

// Runtime playlist (may grow via "Add Stream")
const runtimePlaylist = [...playlist];

export function initMusicPlayer() {
  if (!audio) return;

  audio.addEventListener('play',  () => { setState('music.isPlaying', true);  EventBus.emit(EVENTS.MUSIC_PLAY,  {}); updatePlayUI(true);  });
  audio.addEventListener('pause', () => { setState('music.isPlaying', false); EventBus.emit(EVENTS.MUSIC_PAUSE, {}); updatePlayUI(false); });
  audio.addEventListener('ended', onTrackEnded);
  audio.addEventListener('timeupdate', onTimeUpdate);
  audio.addEventListener('loadedmetadata', () => {
    const track = runtimePlaylist[getState('music.currentIndex') || 0];
    if (!track?.live) {
      setState('music.duration', audio.duration);
      const durEl = document.getElementById('music-duration');
      if (durEl) durEl.textContent = formatTime(audio.duration);
    }
    updateAlbumRing(true);
  });
  audio.addEventListener('error', () => {
    const track = runtimePlaylist[getState('music.currentIndex') || 0];
    if (track) showToast(`Could not load: ${track.title}`);
  });

  document.getElementById('music-play-btn')?.addEventListener('click', togglePlay);
  document.getElementById('music-prev-btn')?.addEventListener('click', prevTrack);
  document.getElementById('music-next-btn')?.addEventListener('click', nextTrack);
  document.getElementById('shuffle-btn')?.addEventListener('click', toggleShuffle);
  document.getElementById('repeat-btn')?.addEventListener('click', toggleRepeat);

  // Seek
  const seekBar = document.getElementById('music-seek-bar');
  let isSeeking = false;
  seekBar?.addEventListener('mousedown', (e) => {
    const track = runtimePlaylist[getState('music.currentIndex') || 0];
    if (track?.live) return;
    isSeeking = true; seekTo(e);
    const onMove = (ev) => { if (isSeeking) seekTo(ev); };
    const onUp = () => { isSeeking = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
  seekBar?.addEventListener('touchstart', (e) => {
    const track = runtimePlaylist[getState('music.currentIndex') || 0];
    if (track?.live) return;
    isSeeking = true; seekTo(e);
  }, { passive: true });
  seekBar?.addEventListener('touchmove', (e) => { if (isSeeking) seekTo(e); }, { passive: true });
  seekBar?.addEventListener('touchend', () => { isSeeking = false; });

  function seekTo(e) {
    if (!seekBar) return;
    const rect = seekBar.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    audio.currentTime = pct * (audio.duration || 0);
  }

  // Add custom stream
  document.getElementById('music-add-btn')?.addEventListener('click', addCustomStream);
  document.getElementById('music-stream-url')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addCustomStream();
  });

  renderPlaylist();
  if (runtimePlaylist.length) loadTrack(0);
}

function addCustomStream() {
  const urlEl   = document.getElementById('music-stream-url');
  const titleEl = document.getElementById('music-stream-title');
  const url = urlEl?.value.trim();
  if (!url) return;

  const isLive = url.includes('.m3u8') || !url.match(/\.(mp3|ogg|flac|wav|aac|opus)(\?|$)/i);
  const title  = titleEl?.value.trim() || guessTitle(url);
  runtimePlaylist.push({
    title,
    artist: 'Custom Stream',
    src: url,
    cover: null,
    duration: isLive ? 'LIVE' : '--:--',
    live: isLive,
  });

  if (urlEl)   urlEl.value   = '';
  if (titleEl) titleEl.value = '';
  renderPlaylist();
  showToast(`Added: ${title}`);
}

function guessTitle(url) {
  try {
    const parts = new URL(url).pathname.split('/');
    const last = parts[parts.length - 1].replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
    return last || 'Custom Stream';
  } catch { return 'Custom Stream'; }
}

function onTimeUpdate() {
  const track = runtimePlaylist[getState('music.currentIndex') || 0];
  if (track?.live) return;

  const ct  = audio.currentTime;
  const dur = audio.duration || 0;
  setState('music.currentTime', ct);

  const prog   = dur > 0 ? ct / dur : 0;
  const progEl = document.getElementById('music-seek-progress');
  const thumbEl = document.getElementById('music-seek-thumb');
  const ctEl   = document.getElementById('music-current-time');
  if (progEl)  progEl.style.width = `${prog * 100}%`;
  if (thumbEl) thumbEl.style.left = `${prog * 100}%`;
  if (ctEl)    ctEl.textContent = formatTime(ct);
}

function onTrackEnded() {
  const state = getState('music');
  if (state.repeat === 'one') {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } else {
    nextTrack();
  }
}

export function loadTrack(index) {
  if (index < 0 || index >= runtimePlaylist.length) return;
  setState('music.currentIndex', index);

  const track = runtimePlaylist[index];
  audio.src   = track.src;

  const trackTitleEl  = document.getElementById('track-title');
  const trackArtistEl = document.getElementById('track-artist');
  const liveBadgeEl   = document.getElementById('music-live-badge');
  const seekContainer = document.getElementById('music-seek-container');

  if (trackTitleEl)  trackTitleEl.textContent  = track.title;
  if (trackArtistEl) trackArtistEl.textContent = track.artist;
  if (liveBadgeEl)   liveBadgeEl.style.display  = track.live ? 'inline-block' : 'none';

  // Hide seek bar for live streams
  if (seekContainer) seekContainer.style.opacity = track.live ? '0.3' : '1';

  const artEl = document.getElementById('album-art');
  if (artEl) {
    artEl.innerHTML = track.cover
      ? `<img src="${track.cover}" alt="${track.title}" />`
      : `<div class="album-placeholder">♪</div>`;
  }

  // Reset seek UI
  const seekProgress  = document.getElementById('music-seek-progress');
  const seekThumb     = document.getElementById('music-seek-thumb');
  const currentTimeEl = document.getElementById('music-current-time');
  const durationEl    = document.getElementById('music-duration');
  if (seekProgress)  seekProgress.style.width = '0%';
  if (seekThumb)     seekThumb.style.left      = '0%';
  if (currentTimeEl) currentTimeEl.textContent  = track.live ? '–' : '0:00';
  if (durationEl)    durationEl.textContent     = track.live ? 'LIVE' : '--:--';

  EventBus.emit(EVENTS.MUSIC_TRACK, track);
  renderPlaylist();
  if (!audioCtx) initAudioContext();
  if (getState('music.isPlaying')) audio.play().catch(() => {});
}

function initAudioContext() {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser  = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    sourceNode = audioCtx.createMediaElementSource(audio);
    sourceNode.connect(analyser);
    analyser.connect(audioCtx.destination);

    const freqData = new Uint8Array(analyser.frequencyBinCount);
    const poll = () => {
      analyser.getByteFrequencyData(freqData);
      EventBus.emit(EVENTS.MUSIC_FREQ, freqData);
      freqTimer = requestAnimationFrame(poll);
    };
    freqTimer = requestAnimationFrame(poll);
    initVisualizer(analyser);
  } catch (err) {
    console.warn('[MusicPlayer] AudioContext init failed:', err.message);
  }
}

function togglePlay() {
  if (audio.paused) {
    audioCtx?.resume();
    audio.play().catch(() => {});
  } else {
    audio.pause();
  }
}

export function nextTrack() {
  const state = getState('music');
  let next = (state.currentIndex || 0) + 1;
  if (state.shuffle) next = Math.floor(Math.random() * runtimePlaylist.length);
  if (next >= runtimePlaylist.length) {
    if (state.repeat === 'all') next = 0;
    else return;
  }
  loadTrack(next);
  if (getState('music.isPlaying')) audio.play().catch(() => {});
}

export function prevTrack() {
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  const state = getState('music');
  let prev = (state.currentIndex || 0) - 1;
  if (prev < 0) prev = runtimePlaylist.length - 1;
  loadTrack(prev);
  if (getState('music.isPlaying')) audio.play().catch(() => {});
}

function toggleShuffle() {
  const newVal = !getState('music.shuffle');
  setState('music.shuffle', newVal);
  document.getElementById('shuffle-btn')?.classList.toggle('active', newVal);
}

function toggleRepeat() {
  const cur  = getState('music.repeat');
  const next = cur === false ? 'all' : cur === 'all' ? 'one' : false;
  setState('music.repeat', next);
  const btn = document.getElementById('repeat-btn');
  btn?.classList.toggle('active', next !== false);
  if (btn) btn.title = next === 'one' ? 'Repeat one' : next === 'all' ? 'Repeat all' : 'Repeat off';
}

function updatePlayUI(playing) {
  const playIcon  = document.getElementById('music-play-icon');
  const pauseIcon = document.getElementById('music-pause-icon');
  const artEl     = document.getElementById('album-art');
  if (playIcon)  playIcon.style.display  = playing ? 'none' : '';
  if (pauseIcon) pauseIcon.style.display = playing ? '' : 'none';
  artEl?.classList.toggle('playing', playing);
}

function updateAlbumRing(active) {
  document.getElementById('album-ring')?.classList.toggle('spinning', active);
}

function renderPlaylist() {
  const container    = document.getElementById('playlist-container');
  if (!container) return;
  const currentIndex = getState('music.currentIndex') || 0;

  container.innerHTML = runtimePlaylist.map((track, i) => `
    <div class="playlist-item${i === currentIndex ? ' active' : ''}" data-index="${i}">
      <span class="playlist-num">${i === currentIndex ? '▶' : i + 1}</span>
      <div class="playlist-art">${track.cover ? `<img src="${track.cover}" alt="" />` : '♪'}</div>
      <div class="playlist-info">
        <p class="playlist-title">${track.title}</p>
        <p class="playlist-artist">${track.artist}</p>
      </div>
      <span class="playlist-duration${track.live ? ' live' : ''}">${track.duration || '--:--'}</span>
    </div>
  `).join('');

  container.querySelectorAll('.playlist-item').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.index);
      loadTrack(idx);
      setState('music.isPlaying', true);
      audioCtx?.resume();
      audio.play().catch(() => {});
    });
  });
}

function showToast(msg) {
  EventBus.emit(EVENTS.TOAST, { msg, duration: 2500 });
}
