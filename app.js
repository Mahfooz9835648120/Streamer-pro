/**
 * Streamer Pro — Main Application Entry Point
 * Bootstraps all modules and wires together the event system.
 */
import './style.css';
import { detectCapability }    from './modules/utils/deviceCapability.js';
import { loadHistory }         from './modules/utils/state.js';
import { initNavigation, initPanels, initToast } from './modules/ui/navigation.js';
import { Orb }                 from './modules/ui/orb.js';
import { initVideoPlayer }     from './modules/video/player.js';
import { initLibrary }         from './modules/video/library.js';
import { initPiP }             from './modules/video/pip.js';
import { initAdmin }           from './modules/video/admin.js';
import { initMusicPlayer }     from './modules/music/player.js';
import { initTelepartyClient } from './modules/teleparty/client.js';
import { initRoom }            from './modules/teleparty/room.js';
import { initChat }            from './modules/teleparty/chat.js';

async function boot() {
  const { isLowEnd } = detectCapability();
  console.log(`[StreamerPro] Booting. Low-perf mode: ${isLowEnd}`);

  loadHistory();

  initNavigation();
  const panels = initPanels();
  initToast();

  Orb.init();

  initVideoPlayer();
  await initLibrary();
  initPiP();

  // Admin panel must come after library (it triggers library refresh)
  initAdmin();

  initMusicPlayer();

  initTelepartyClient();
  initRoom();
  initChat();

  initInstallPrompt();

  console.log('[StreamerPro] App ready ✓');
}

function initInstallPrompt() {
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });

  if (window.matchMedia('(display-mode: standalone)').matches) {
    document.documentElement.dataset.standalone = 'true';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
