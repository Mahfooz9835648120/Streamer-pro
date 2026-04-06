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

export function initMusicPlayer() {
  if (!audio) return;
  injectSupportedFormats();
  injectMusicUrlForm();

  audio.addEventListener('play', () => { setState('music.isPlaying', true); EventBus.emit(EVENTS.MUSIC_PLAY, {}); updatePlayUI(true); });
  audio.addEventListener('pause', () => { setState('music.isPlaying', false); EventBus.emit(EVENTS.MUSIC_PAUSE, {}); updatePlayUI(false); });
  audio.addEventListener('ended', onTrackEnded);
  audio.addEventListener('timeupdate', onTimeUpdate);
  audio.addEventListener('loadedmetadata', () => {
    setState('music.duration', audio.duration);
    const durEl = document.getElementById('music-duration');
    if (durEl) durEl.textContent = formatTime(audio.duration);
    updateAlbumRing(true);
  });
  audio.addEventListener('error', () => {
    EventBus.emit(EVENTS.TOAST, { msg: '⚠ Unsupported audio stream. Try MP3, AAC, OGG, WAV, FLAC, HLS, or DASH.' });
  });

  document.getElementById('music-play-btn')?.addEventListener('click', togglePlay);
  document.getElementById('music-prev-btn')?.addEventListener('click', prevTrack);
  document.getElementById('music-next-btn')?.addEventListener('click', nextTrack);
  document.getElementById('shuffle-btn')?.addEventListener('click', toggleShuffle);
  document.getElementById('repeat-btn')?.addEventListener('click', toggleRepeat);

  const seekBar = document.getElementById('music-seek-bar');
  let isSeeking = false;
  seekBar?.addEventListener('mousedown', (e) => {
    isSeeking = true; seekTo(e);
    const onMove = (ev) => { if (isSeeking) seekTo(ev); };
    const onUp = () => { isSeeking = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
  seekBar?.addEventListener('touchstart', (e) => { isSeeking = true; seekTo(e); }, { passive: true });
  seekBar?.addEventListener('touchmove', (e) => { if (isSeeking) seekTo(e); }, { passive: true });
  seekBar?.addEventListener('touchend', () => { isSeeking = false; });

  function seekTo(e) {
    if (!seekBar) return;
    const rect = seekBar.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    audio.currentTime = pct * (audio.duration || 0);
  }

  renderPlaylist();
  if (playlist.length) loadTrack(0);
}

function injectSupportedFormats() {
  const musicMode = document.getElementById('music-mode');
  if (!musicMode || document.getElementById('music-supported-formats')) return;
  const support = document.createElement('div');
  support.id = 'music-supported-formats';
  support.className = 'stream-info';
  support.style.marginBottom = '12px';
  support.innerHTML = `
    <span class="badge">MUSIC SUPPORT</span>
    <span class="badge dim">MP3</span>
    <span class="badge dim">AAC</span>
    <span class="badge dim">OGG</span>
    <span class="badge dim">WAV</span>
    <span class="badge dim">FLAC</span>
    <span class="badge dim">HLS</span>
    <span class="badge dim">DASH</span>
  `;
  musicMode.prepend(support);
}

function injectMusicUrlForm() {
  const musicMode = document.getElementById('music-mode');
  if (!musicMode || document.getElementById('music-url-form')) return;
  const form = document.createElement('div');
  form.id = 'music-url-form';
  form.className = 'form-group';
  form.style.marginBottom = '12px';
  form.innerHTML = `
    <label>Add music stream URL</label>
    <div style="display:flex;gap:8px;align-items:center">
      <input type="url" id="music-url-input" placeholder="https://example.com/stream.mp3" />
      <button class="primary-btn" id="music-url-add-btn" type="button">Add</button>
    </div>
  `;
  musicMode.prepend(form);

  const input = form.querySelector('#music-url-input');
  const addBtn = form.querySelector('#music-url-add-btn');
  addBtn?.addEventListener('click', () => {
    const src = input?.value?.trim();
    if (!src) {
      EventBus.emit(EVENTS.TOAST, { msg: 'Enter a music stream URL first.' });
      return;
    }
    const title = `Custom Stream ${playlist.length + 1}`;
    playlist.unshift({
      title,
      artist: 'User Added',
      src,
      cover: null,
      duration: 'Live',
    });
    renderPlaylist();
    loadTrack(0);
    setState('music.isPlaying', true);
    audioCtx?.resume();
    audio.play().catch(() => {});
    EventBus.emit(EVENTS.TOAST, { msg: '✓ Music stream added' });
    if (input) input.value = '';
  });
}

function onTimeUpdate() {
  const ct = audio.currentTime;
  const dur = audio.duration || 0;
  setState('music.currentTime', ct);

  const prog = dur > 0 ? ct / dur : 0;
  const progEl = document.getElementById('music-seek-progress');
  const thumbEl = document.getElementById('music-seek-thumb');
  const ctEl = document.getElementById('music-current-time');
  if (progEl) progEl.style.width = `${prog * 100}%`;
  if (thumbEl) thumbEl.style.left = `${prog * 100}%`;
  if (ctEl) ctEl.textContent = formatTime(ct);
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
  if (index < 0 || index >= playlist.length) return;
  setState('music.currentIndex', index);

  const track = playlist[index];
  audio.src = track.src;

  const trackTitleEl = document.getElementById('track-title');
  const trackArtistEl = document.getElementById('track-artist');
  if (trackTitleEl) trackTitleEl.textContent = track.title;
  if (trackArtistEl) trackArtistEl.textContent = track.artist;

  const artEl = document.getElementById('album-art');
  if (artEl) {
    artEl.innerHTML = track.cover ? `<img src="${track.cover}" alt="${track.title}" />` : `<div class="album-placeholder">♪</div>`;
  }

  const seekProgress = document.getElementById('music-seek-progress');
  const seekThumb = document.getElementById('music-seek-thumb');
  const currentTimeEl = document.getElementById('music-current-time');
  const durationEl = document.getElementById('music-duration');
  if (seekProgress) seekProgress.style.width = '0%';
  if (seekThumb) seekThumb.style.left = '0%';
  if (currentTimeEl) currentTimeEl.textContent = '0:00';
  if (durationEl) durationEl.textContent = '--:--';

  EventBus.emit(EVENTS.MUSIC_TRACK, track);
  renderPlaylist();
  if (!audioCtx) initAudioContext();
  if (getState('music.isPlaying')) audio.play().catch(() => {});
}

function initAudioContext() {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 128;
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
  let next = state.currentIndex + 1;
  if (state.shuffle) next = Math.floor(Math.random() * playlist.length);
  if (next >= playlist.length) {
    if (state.repeat === 'all') next = 0;
    else return;
  }
  loadTrack(next);
  if (getState('music.isPlaying')) audio.play().catch(() => {});
}

export function prevTrack() {
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  const state = getState('music');
  let prev = state.currentIndex - 1;
  if (prev < 0) prev = playlist.length - 1;
  loadTrack(prev);
  if (getState('music.isPlaying')) audio.play().catch(() => {});
}

function toggleShuffle() {
  const newVal = !getState('music.shuffle');
  setState('music.shuffle', newVal);
  document.getElementById('shuffle-btn')?.classList.toggle('active', newVal);
}

function toggleRepeat() {
  const cur = getState('music.repeat');
  const next = cur === false ? 'all' : cur === 'all' ? 'one' : false;
  setState('music.repeat', next);
  const btn = document.getElementById('repeat-btn');
  btn?.classList.toggle('active', next !== false);
  if (btn) btn.title = next === 'one' ? 'Repeat one' : next === 'all' ? 'Repeat all' : 'Repeat off';
}

function updatePlayUI(playing) {
  const playIcon = document.getElementById('music-play-icon');
  const pauseIcon = document.getElementById('music-pause-icon');
  const artEl = document.getElementById('album-art');
  if (playIcon) playIcon.style.display = playing ? 'none' : '';
  if (pauseIcon) pauseIcon.style.display = playing ? '' : 'none';
  artEl?.classList.toggle('playing', playing);
}

function updateAlbumRing(active) {
  document.getElementById('album-ring')?.classList.toggle('spinning', active);
}

function renderPlaylist() {
  const container = document.getElementById('playlist-container');
  if (!container) return;
  const currentIndex = getState('music.currentIndex');

  container.innerHTML = playlist.map((track, i) => `
    <div class="playlist-item${i === currentIndex ? ' active' : ''}" data-index="${i}">
      <span class="playlist-num">${i === currentIndex ? '▶' : i + 1}</span>
      <div class="playlist-art">${track.cover ? `<img src="${track.cover}" alt="" />` : '♪'}</div>
      <div class="playlist-info">
        <p class="playlist-title">${track.title}</p>
        <p class="playlist-artist">${track.artist}</p>
      </div>
      <span class="playlist-duration">${track.duration || '--:--'}</span>
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
