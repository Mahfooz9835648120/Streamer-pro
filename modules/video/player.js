/**
 * Video Player — Orchestrates playback, engine selection (HLS / DASH / Chunk / Direct).
 * Manages watch history and continue-watching.
 */
import { EventBus, EVENTS } from '../utils/eventBus.js';
import { getState, setState, addToHistory } from '../utils/state.js';
import { HLSEngine } from '../engine/hlsEngine.js';
import { DASHEngine } from '../engine/dashEngine.js';
import { ChunkEngine } from '../engine/chunkEngine.js';
import { formatTime } from '../utils/format.js';
import { initControls } from './controls.js';
import { initGestures } from './gestures.js';

let hlsEngine  = null;
let dashEngine = null;
let chunkEngine = null;
const video = document.getElementById('main-video');

export function initVideoPlayer() {
  if (!video) return;

  initControls(video);
  initGestures(video);

  // Video native events → EventBus
  video.addEventListener('play',       () => { setState('video.isPlaying', true);  EventBus.emit(EVENTS.VIDEO_PLAY, {}); });
  video.addEventListener('pause',      () => { setState('video.isPlaying', false); EventBus.emit(EVENTS.VIDEO_PAUSE, {}); });
  video.addEventListener('ended',      () => { setState('video.isPlaying', false); EventBus.emit(EVENTS.VIDEO_ENDED, {}); });
  video.addEventListener('timeupdate', onTimeUpdate);
  video.addEventListener('progress',   onProgress);
  video.addEventListener('waiting',    onWaiting);
  video.addEventListener('canplay',    onCanPlay);
  video.addEventListener('error',      onError);

  // Respond to teleparty sync
  EventBus.on(EVENTS.PARTY_PLAY,  () => { if (video.paused) video.play().catch(() => {}); });
  EventBus.on(EVENTS.PARTY_PAUSE, () => { if (!video.paused) video.pause(); });
  EventBus.on(EVENTS.PARTY_SEEK,  ({ time }) => { video.currentTime = time; });

  // Volume control
  document.getElementById('volume-slider')?.addEventListener('input', e => {
    video.volume = parseFloat(e.target.value);
    setState('video.volume', video.volume);
  });
  document.getElementById('mute-btn')?.addEventListener('click', () => {
    video.muted = !video.muted;
    setState('video.muted', video.muted);
  });
}

function onTimeUpdate() {
  const ct  = video.currentTime;
  const dur = video.duration || 0;
  setState('video.currentTime', ct);
  setState('video.duration', dur);
  EventBus.emit(EVENTS.VIDEO_TIME, { currentTime: ct, duration: dur });

  if (Math.floor(ct) % 5 === 0 && ct > 2) {
    const src = getState('video.src');
    if (src) addToHistory({ src, title: getState('video.title'), currentTime: ct, duration: dur });
  }
}

function onProgress() {
  if (!video.buffered.length) return;
  const buffEnd = video.buffered.end(video.buffered.length - 1);
  const dur     = video.duration || 1;
  const pct     = Math.min(buffEnd / dur, 1);
  setState('video.buffered', pct);

  const statusEl = document.getElementById('buffer-status');
  if (statusEl) statusEl.textContent = `BUFFER: ${(buffEnd - video.currentTime).toFixed(1)}s`;

  EventBus.emit(EVENTS.VIDEO_BUFFER, { buffered: pct });
}

function onWaiting() {
  if (chunkEngine) chunkEngine.bufferManager?.onStall();
}

function onCanPlay() {
  if (!getState('video.isPlaying')) return;
}

function onError() {
  const err = video.error;
  // Ignore empty-src errors (player not yet loaded)
  if (!video.src || video.src === window.location.href) return;
  console.error('[VideoPlayer] Error:', err?.code, err?.message);
  EventBus.emit(EVENTS.VIDEO_ERROR, { code: err?.code, msg: err?.message });
  EventBus.emit(EVENTS.TOAST, { msg: '⚠ Video playback error — check URL or format' });
}

/**
 * Auto-detect streaming format from URL.
 * Returns: 'hls' | 'dash' | 'direct'
 */
export function detectStreamFormat(url) {
  if (!url) return 'direct';
  const lower = url.toLowerCase().split('?')[0]; // ignore query params for detection
  if (lower.includes('.m3u8') || lower.includes('x-mpegurl') || lower.includes('mpegurl')) return 'hls';
  if (lower.includes('.mpd')  || lower.includes('dash+xml'))  return 'dash';
  return 'direct';
}

/**
 * Get a human-readable format label from URL.
 */
export function getFormatLabel(url) {
  if (!url) return 'STREAM';
  const lower = url.toLowerCase().split('?')[0];
  if (lower.endsWith('.m3u8') || lower.includes('m3u8')) return 'HLS';
  if (lower.endsWith('.mpd')  || lower.includes('.mpd')) return 'DASH';
  if (lower.endsWith('.mp4')  || lower.endsWith('.m4v')) return 'MP4';
  if (lower.endsWith('.webm'))  return 'WEBM';
  if (lower.endsWith('.ogv') || lower.endsWith('.ogg')) return 'OGV';
  if (lower.endsWith('.ts')  || lower.endsWith('.mts')) return 'MPEG-TS';
  if (lower.endsWith('.mkv'))   return 'MKV';
  if (lower.endsWith('.avi'))   return 'AVI';
  if (lower.endsWith('.mov'))   return 'MOV';
  if (lower.endsWith('.flv'))   return 'FLV';
  return 'STREAM';
}

/**
 * Load and play a video source.
 * Auto-detects: HLS → DASH → Direct (with optional chunk engine for MP4).
 */
export async function loadVideo({ src, title = 'Untitled', thumbnail = null, startTime = 0 }) {
  if (!src) return;

  destroy();

  setState('video.src', src);
  setState('video.title', title);
  setState('video.isHLS',  false);
  setState('video.isDASH', false);
  setState('video.isChunked', false);

  // Update UI
  const titleEl     = document.getElementById('video-title-display');
  const hlsBadge    = document.getElementById('hls-badge');
  const qualityBadge = document.getElementById('quality-badge');
  const formatBadge  = document.getElementById('format-badge');

  if (titleEl)     titleEl.textContent = title;
  if (hlsBadge)    hlsBadge.style.display = 'none';
  if (qualityBadge) qualityBadge.textContent = 'AUTO';
  if (formatBadge)  formatBadge.textContent = getFormatLabel(src);

  addToHistory({ src, title, thumbnail, currentTime: 0, duration: 0 });

  const format = detectStreamFormat(src);
  console.log(`[VideoPlayer] Detected format: ${format.toUpperCase()} for ${src}`);

  if (format === 'hls') {
    // HLS mode
    hlsEngine = new HLSEngine(video);
    const ok = await hlsEngine.load(src);
    if (ok) {
      setState('video.isHLS', true);
      if (hlsBadge)    hlsBadge.style.display = '';
      if (qualityBadge) qualityBadge.textContent = 'HLS';
    } else {
      EventBus.emit(EVENTS.TOAST, { msg: '⚠ HLS stream failed to load' });
      return;
    }
  } else if (format === 'dash') {
    // DASH mode
    dashEngine = new DASHEngine(video);
    const ok = await dashEngine.load(src);
    if (ok) {
      setState('video.isDASH', true);
      if (qualityBadge) qualityBadge.textContent = 'DASH';
    } else {
      EventBus.emit(EVENTS.TOAST, { msg: '⚠ DASH stream failed to load' });
      return;
    }
  } else {
    // Direct / Chunk engine for MP4 range-request streaming
    chunkEngine = new ChunkEngine(video, src);
    const ok = await chunkEngine.start();
    if (ok) {
      setState('video.isChunked', true);
      if (qualityBadge) qualityBadge.textContent = 'STREAM';
    }
    // If chunk engine falls back, ChunkEngine already set video.src directly
  }

  // Seek to continue-watching position
  if (startTime > 5) {
    video.addEventListener('loadedmetadata', () => {
      video.currentTime = startTime;
    }, { once: true });
  }

  // Auto-play
  try {
    await video.play();
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.warn('[VideoPlayer] Autoplay blocked:', err.message);
    }
  }
}

function destroy() {
  if (hlsEngine)   { hlsEngine.destroy();   hlsEngine   = null; }
  if (dashEngine)  { dashEngine.destroy();  dashEngine  = null; }
  if (chunkEngine) { chunkEngine.destroy(); chunkEngine = null; }
  // Only clear src if it was set directly (not via MSE/hls)
  video.pause();
  try { video.src = ''; video.load(); } catch {}
}

export function getVideoEl() { return video; }
