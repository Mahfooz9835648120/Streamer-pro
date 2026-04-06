/**
 * Streamer Pro — Main Application Entry Point
 */
import './style.css';
import { detectCapability } from './modules/utils/deviceCapability.js';
import { loadHistory } from './modules/utils/state.js';
import { initNavigation, initPanels, initToast } from './modules/ui/navigation.js';
import { Orb } from './modules/ui/orb.js';
import { initVideoPlayer } from './modules/video/player.js';
import { initLibrary } from './modules/video/library.js';
import { initPiP } from './modules/video/pip.js';
import { initMusicPlayer } from './modules/music/player.js';
import { initTelepartyClient } from './modules/teleparty/client.js';
import { initRoom } from './modules/teleparty/room.js';
import { initChat } from './modules/teleparty/chat.js';

async function boot() {
  const { isLowEnd } = detectCapability();
  console.log(`[StreamerPro] Booting. Low-perf mode: ${isLowEnd}`);

  loadHistory();
  initNavigation();
  initPanels();
  initToast();
  Orb.init();
  initVideoPlayer();
  await initLibrary();
  initPiP();
  initMusicPlayer();
  initTelepartyClient();
  initRoom();
  initChat();
  initInstallPrompt();
  console.log('[StreamerPro] App ready ✓');
}

function initInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => e.preventDefault());
  if (window.matchMedia('(display-mode: standalone)').matches) {
    document.documentElement.dataset.standalone = 'true';
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
