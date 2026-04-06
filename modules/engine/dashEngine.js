/**
 * DASH Engine — wraps dash.js for .mpd stream playback.
 * Falls back to native video src if DASH.js fails.
 */
import { EventBus, EVENTS } from '../utils/eventBus.js';

export class DASHEngine {
  constructor(video) {
    this.video = video;
    this.player = null;
    this._active = false;
  }

  static isDASH(url) {
    const lower = url.toLowerCase();
    return lower.includes('.mpd') || lower.includes('application/dash+xml');
  }

  async load(url) {
    let dashjs;
    try {
      const mod = await import('dashjs');
      dashjs = mod.default || mod;
    } catch {
      console.warn('[DASHEngine] dash.js not available, falling back to native');
      this.video.src = url;
      this._active = true;
      return true;
    }

    try {
      this.destroy();
      this.player = dashjs.MediaPlayer().create();
      this.player.initialize(this.video, url, false);
      this.player.updateSettings({
        streaming: {
          abr: { autoSwitchBitrate: { video: true, audio: true } },
          buffer: { fastSwitchEnabled: true },
        },
      });

      this._active = true;

      this.player.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, () => {
        console.log('[DASHEngine] Stream initialized');
        EventBus.emit(EVENTS.VIDEO_LOADED, { src: url, isDASH: true });
        const qualityBadge = document.getElementById('quality-badge');
        if (qualityBadge) qualityBadge.textContent = 'DASH';
      });

      this.player.on(dashjs.MediaPlayer.events.ERROR, (e) => {
        console.error('[DASHEngine] Error:', e);
        EventBus.emit(EVENTS.VIDEO_ERROR, { msg: 'DASH stream error' });
      });

      this.player.on(dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, (e) => {
        const qualityBadge = document.getElementById('quality-badge');
        if (qualityBadge && e.mediaType === 'video') {
          const bw = this.player.getBitrateInfoListFor('video');
          const q = bw[e.newQuality];
          if (q && q.height) qualityBadge.textContent = `${q.height}p`;
        }
      });

      return true;
    } catch (err) {
      console.warn('[DASHEngine] Initialization failed, falling back to native:', err.message);
      this.video.src = url;
      this._active = true;
      return true;
    }
  }

  get isActive() { return this._active; }

  destroy() {
    if (this.player) {
      try { this.player.reset(); } catch {}
      this.player = null;
    }
    this._active = false;
  }
}
