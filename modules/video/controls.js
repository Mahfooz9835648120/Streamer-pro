/**
 * Video Controls — Play/Pause, seek, fullscreen, auto-hide.
 */
import { EventBus, EVENTS } from '../utils/eventBus.js';
import { getState } from '../utils/state.js';
import { formatTime } from '../utils/format.js';
import { flashIcon } from '../ui/transitions.js';

let hideTimer = null;
let isSeeking = false;

export function initControls(video) {
  const container    = document.getElementById('video-container');
  const controls     = document.getElementById('video-controls');
  const playPauseBtn = document.getElementById('play-pause-btn');
  const playIcon     = document.getElementById('play-icon');
  const pauseIcon    = document.getElementById('pause-icon');
  const skipBackBtn  = document.getElementById('skip-back-btn');
  const skipFwdBtn   = document.getElementById('skip-fwd-btn');
  const seekBar      = document.getElementById('seek-bar');
  const seekProg     = document.getElementById('seek-progress');
  const seekBuf      = document.getElementById('seek-buffer');
  const seekThumb    = document.getElementById('seek-thumb');
  const timeDisplay  = document.getElementById('time-display');
  const fullscreenBtn= document.getElementById('fullscreen-btn');
  const muteBtn      = document.getElementById('mute-btn');

  if (!container) return;

  // ——— Auto-hide controls ———
  function showControls() {
    container.classList.add('controls-visible');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!video.paused) container.classList.remove('controls-visible');
    }, 3000);
  }
  container.addEventListener('mousemove', showControls, { passive: true });
  container.addEventListener('touchstart', showControls, { passive: true });

  // Always show when paused
  EventBus.on(EVENTS.VIDEO_PAUSE, () => container.classList.add('controls-visible'));
  EventBus.on(EVENTS.VIDEO_PLAY,  () => {
    showControls();
  });

  // ——— Play / Pause button ———
  playPauseBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePlay(video, container);
  });

  // ——— Tap overlay (tap to play/pause, double-tap to seek) ———
  const tapOverlay = document.getElementById('tap-overlay');
  let lastTap = 0;
  let touchStartX = 0;
  let touchStartY = 0;
  let touchMoved = false;
  tapOverlay?.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchMoved = false;
  }, { passive: true });
  tapOverlay?.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 1) return;
    const dx = Math.abs(e.touches[0].clientX - touchStartX);
    const dy = Math.abs(e.touches[0].clientY - touchStartY);
    if (dx > 8 || dy > 8) touchMoved = true;
  }, { passive: true });
  tapOverlay?.addEventListener('click', (e) => {
    if (!('ontouchstart' in window)) {
      showControls();
      return;
    }
    if (touchMoved) return;
    const now = Date.now();
    if (now - lastTap < 300) {
      // Double-tap: seek based on side
      const side = e.clientX < window.innerWidth / 2 ? 'left' : 'right';
      video.currentTime += side === 'left' ? -10 : 10;
      flashIcon(container, side === 'left' ? '-10s' : '+10s');
    } else {
      // Single tap should only reveal controls; avoid accidental play/pause toggles.
      showControls();
    }
    lastTap = now;
  });

  // ——— Skip buttons ———
  skipBackBtn?.addEventListener('click', (e) => { e.stopPropagation(); video.currentTime -= 10; flashIcon(container, '-10s'); });
  skipFwdBtn?.addEventListener('click',  (e) => { e.stopPropagation(); video.currentTime += 10; flashIcon(container, '+10s'); });

  // ——— Seek bar ———
  function updateSeekBar(progress, buffered) {
    if (seekProg)  seekProg.style.width  = `${progress * 100}%`;
    if (seekBuf)   seekBuf.style.width   = `${buffered * 100}%`;
    if (seekThumb) seekThumb.style.left  = `${progress * 100}%`;
  }

  EventBus.on(EVENTS.VIDEO_TIME, ({ currentTime, duration }) => {
    if (isSeeking || !duration) return;
    const prog = currentTime / duration;
    updateSeekBar(prog, getState('video.buffered') || 0);
    if (timeDisplay) timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
  });

  EventBus.on(EVENTS.VIDEO_BUFFER, ({ buffered }) => {
    if (!isSeeking) updateSeekBar((video.currentTime / (video.duration || 1)), buffered);
  });

  // Seek bar click/drag
  function seekTo(e) {
    const rect = seekBar.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    video.currentTime = pct * video.duration;
    updateSeekBar(pct, getState('video.buffered') || 0);
    // Emit for teleparty sync
    EventBus.emit(EVENTS.PARTY_SEEK, { time: video.currentTime });
  }

  seekBar?.addEventListener('mousedown', (e) => {
    isSeeking = true;
    seekTo(e);
    const onMove = (ev) => { if (isSeeking) seekTo(ev); };
    const onUp   = () => { isSeeking = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
  seekBar?.addEventListener('touchstart', (e) => {
    isSeeking = true; seekTo(e);
  }, { passive: true });
  seekBar?.addEventListener('touchmove', (e) => {
    if (isSeeking) seekTo(e);
  }, { passive: true });
  seekBar?.addEventListener('touchend', () => { isSeeking = false; });

  // ——— Fullscreen ———
  fullscreenBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!document.fullscreenElement) {
      container.requestFullscreen?.() || container.webkitRequestFullscreen?.();
    } else {
      document.exitFullscreen?.() || document.webkitExitFullscreen?.();
    }
  });
  document.addEventListener('fullscreenchange', async () => {
    const orientation = screen.orientation;
    if (!orientation?.lock) return;
    try {
      if (document.fullscreenElement) await orientation.lock('landscape');
      else orientation.unlock?.();
    } catch {
      // Some browsers block orientation lock; ignore gracefully.
    }
  });

  // ——— Play/pause icon sync ———
  EventBus.on(EVENTS.VIDEO_PLAY,  () => { if (playIcon) playIcon.style.display = 'none'; if (pauseIcon) pauseIcon.style.display = ''; });
  EventBus.on(EVENTS.VIDEO_PAUSE, () => { if (playIcon) playIcon.style.display = '';     if (pauseIcon) pauseIcon.style.display = 'none'; });

  // ——— Mute ———
  muteBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    video.muted = !video.muted;
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    switch (e.key) {
      case ' ':
      case 'k': e.preventDefault(); togglePlay(video, container); break;
      case 'ArrowLeft':  e.preventDefault(); video.currentTime -= 10; flashIcon(container, '-10s'); break;
      case 'ArrowRight': e.preventDefault(); video.currentTime += 10; flashIcon(container, '+10s'); break;
      case 'm': video.muted = !video.muted; break;
      case 'f': fullscreenBtn?.click(); break;
    }
  });
}

function togglePlay(video, container) {
  if (video.paused) {
    video.play().catch(() => {});
    EventBus.emit(EVENTS.PARTY_PLAY, {});
    flashIcon(container, 'PLAY');
  } else {
    video.pause();
    EventBus.emit(EVENTS.PARTY_PAUSE, {});
    flashIcon(container, 'PAUSE');
  }
}
