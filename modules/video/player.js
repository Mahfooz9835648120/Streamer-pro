/**
 * Video Player — Orchestrates playback, engine selection (HLS / DASH / Chunk / Direct).
 * Manages watch history and continue-watching.
 */
import { EventBus, EVENTS } from '../utils/eventBus.js';
import { getState, setState } from '../utils/state.js';
import { HLSEngine } from '../engine/hlsEngine.js';
import { DASHEngine } from '../engine/dashEngine.js';
import { ChunkEngine } from '../engine/chunkEngine.js';
import { initControls } from './controls.js';
import { initGestures } from './gestures.js';

let hlsEngine = null;
let dashEngine = null;
let chunkEngine = null;
const video = document.getElementById('main-video');

export function initVideoPlayer() {
  if (!video) return;
  initControls(video);
  initGestures(video);
  video.addEventListener('play', () => { setState('video.isPlaying', true); EventBus.emit(EVENTS.VIDEO_PLAY, {}); });
  video.addEventListener('pause', () => { setState('video.isPlaying', false); EventBus.emit(EVENTS.VIDEO_PAUSE, {}); });
  video.addEventListener('ended', () => { setState('video.isPlaying', false); EventBus.emit(EVENTS.VIDEO_ENDED, {}); });
  video.addEventListener('timeupdate', onTimeUpdate);
  video.addEventListener('progress', onProgress);
  video.addEventListener('waiting', onWaiting);
  video.addEventListener('canplay', onCanPlay);
  video.addEventListener('error', onError);
  EventBus.on(EVENTS.PARTY_PLAY, () => { if (video.paused) video.play().catch(() => {}); });
  EventBus.on(EVENTS.PARTY_PAUSE, () => { if (!video.paused) video.pause(); });
  EventBus.on(EVENTS.PARTY_SEEK, ({ time }) => { video.currentTime = time; });
  document.getElementById('volume-slider')?.addEventListener('input', e => { video.volume = parseFloat(e.target.value); setState('video.volume', video.volume); });
  document.getElementById('mute-btn')?.addEventListener('click', () => { video.muted = !video.muted; setState('video.muted', video.muted); });
}

function onTimeUpdate() {
  const ct = video.currentTime;
  const dur = video.duration || 0;
  setState('video.currentTime', ct);
  setState('video.duration', dur);
  EventBus.emit(EVENTS.VIDEO_TIME, { currentTime: ct, duration: dur });
}

function onProgress() {
  if (!video.buffered.length) return;
  const buffEnd = video.buffered.end(video.buffered.length - 1);
  const dur = video.duration || 1;
  const pct = Math.min(buffEnd / dur, 1);
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
  if (!video.src || video.src === window.location.href) return;
  console.error('[VideoPlayer] Error:', err?.code, err?.message);
  EventBus.emit(EVENTS.VIDEO_ERROR, { code: err?.code, msg: err?.message });
  EventBus.emit(EVENTS.TOAST, { msg: '⚠ Video playback error — check URL or format' });
}

export function detectStreamFormat(url) {
  if (!url) return 'direct';
  const lower = url.toLowerCase().split('?')[0];
  if (lower.includes('youtube.com/watch') || lower.includes('youtu.be/')) return 'youtube';
  if (lower.includes('.m3u8') || lower.includes('x-mpegurl') || lower.includes('mpegurl')) return 'hls';
  if (lower.includes('.mpd') || lower.includes('dash+xml')) return 'dash';
  if (lower.includes('.mp4') || lower.includes('.m4v') || lower.includes('.webm') || lower.includes('.ogv') || lower.includes('.ogg') || lower.includes('.mov') || lower.includes('.mkv') || lower.includes('.avi') || lower.includes('.flv')) return 'direct';
  return 'page';
}

export function getFormatLabel(url) {
  if (!url) return 'STREAM';
  const lower = url.toLowerCase().split('?')[0];
  if (lower.includes('youtube.com/watch') || lower.includes('youtu.be/')) return 'YOUTUBE';
  if (lower.endsWith('.m3u8') || lower.includes('m3u8')) return 'HLS';
  if (lower.endsWith('.mpd') || lower.includes('.mpd')) return 'DASH';
  if (lower.endsWith('.mp4') || lower.endsWith('.m4v')) return 'MP4';
  if (lower.endsWith('.webm')) return 'WEBM';
  if (lower.endsWith('.ogv') || lower.endsWith('.ogg')) return 'OGV';
  if (lower.endsWith('.ts') || lower.endsWith('.mts')) return 'MPEG-TS';
  if (lower.endsWith('.mkv')) return 'MKV';
  if (lower.endsWith('.avi')) return 'AVI';
  if (lower.endsWith('.mov')) return 'MOV';
  if (lower.endsWith('.flv')) return 'FLV';
  return 'STREAM';
}

function isProbablyVideoPage(url) {
  const lower = url.toLowerCase();
  return lower.includes('youtube.com/watch') || lower.includes('youtu.be/') || lower.includes('vimeo.com/') || lower.includes('dailymotion.com/') || lower.includes('twitch.tv/') || lower.includes('facebook.com/watch');
}

function isPlayableDirect(url) {
  const lower = url.toLowerCase().split('?')[0];
  return lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.ogv') || lower.endsWith('.ogg') || lower.endsWith('.mov') || lower.endsWith('.mkv') || lower.endsWith('.avi') || lower.endsWith('.flv') || lower.endsWith('.m3u8') || lower.endsWith('.mpd');
}

async function tryDirect(url) {
  if (isProbablyVideoPage(url)) return false;
  if (!isPlayableDirect(url)) return false;
  video.src = url;
  try {
    await video.play();
    return true;
  } catch {
    return true;
  }
}

export async function loadVideo({ src, title = 'Untitled', thumbnail = null, startTime = 0 }) {
  if (!src) return;
  destroy();
  setState('video.src', src);
  setState('video.title', title);
  setState('video.isHLS', false);
  setState('video.isDASH', false);
  setState('video.isChunked', false);
  const titleEl = document.getElementById('video-title-display');
  const hlsBadge = document.getElementById('hls-badge');
  const qualityBadge = document.getElementById('quality-badge');
  const formatBadge = document.getElementById('format-badge');
  if (titleEl) titleEl.textContent = title;
  if (hlsBadge) hlsBadge.style.display = 'none';
  if (qualityBadge) qualityBadge.textContent = 'AUTO';
  if (formatBadge) formatBadge.textContent = getFormatLabel(src);
  const format = detectStreamFormat(src);
  console.log(`[VideoPlayer] Detected format: ${format.toUpperCase()} for ${src}`);
  if (format === 'youtube' || format === 'page') {
    const ok = await tryDirect(src);
    if (!ok) EventBus.emit(EVENTS.TOAST, { msg: '⚠ This link needs a direct video stream URL to play here' });
  } else if (format === 'hls') {
    hlsEngine = new HLSEngine(video);
    const ok = await hlsEngine.load(src);
    if (ok) {
      setState('video.isHLS', true);
      if (hlsBadge) hlsBadge.style.display = '';
      if (qualityBadge) qualityBadge.textContent = 'HLS';
    } else {
      EventBus.emit(EVENTS.TOAST, { msg: '⚠ HLS stream failed to load' });
      return;
    }
  } else if (format === 'dash') {
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
    chunkEngine = new ChunkEngine(video, src);
    const ok = await chunkEngine.start();
    if (ok) {
      setState('video.isChunked', true);
      if (qualityBadge) qualityBadge.textContent = 'STREAM';
    }
  }
  if (startTime > 5) {
    video.addEventListener('loadedmetadata', () => { video.currentTime = startTime; }, { once: true });
  }
  try {
    await video.play();
  } catch (err) {
    if (err.name !== 'AbortError') console.warn('[VideoPlayer] Autoplay blocked:', err.message);
  }
}

function destroy() {
  if (hlsEngine) { hlsEngine.destroy(); hlsEngine = null; }
  if (dashEngine) { dashEngine.destroy(); dashEngine = null; }
  if (chunkEngine) { chunkEngine.destroy(); chunkEngine = null; }
  video.pause();
  try { video.src = ''; video.load(); } catch {}
}

export function getVideoEl() { return video; }
