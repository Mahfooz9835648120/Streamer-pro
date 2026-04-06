/**
 * Admin Panel — Add, manage and remove custom video streaming links.
 * Stores videos in localStorage so they persist across sessions.
 * Panel open/close is handled by navigation.js initPanels().
 */
import { EventBus, EVENTS } from '../utils/eventBus.js';
import { getFormatLabel } from './player.js';

const STORAGE_KEY = 'streamer-pro:admin-videos';

export function getAdminVideos() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveAdminVideos(videos) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(videos));
}

export function initAdmin() {
  const form       = document.getElementById('admin-video-form');
  const urlInput   = document.getElementById('admin-url');
  const titleInput = document.getElementById('admin-title');
  const thumbInput = document.getElementById('admin-thumb');
  const descInput  = document.getElementById('admin-desc');
  const detectBtn  = document.getElementById('admin-detect-btn');
  const fmtSpan    = document.getElementById('admin-detected-format');
  const listEl     = document.getElementById('admin-video-list');

  if (!form) return;

  // Auto-detect format on URL blur
  urlInput?.addEventListener('blur', () => {
    const url = urlInput.value.trim();
    if (url && fmtSpan) fmtSpan.textContent = getFormatLabel(url);
  });

  // Detect button
  detectBtn?.addEventListener('click', () => {
    const url = urlInput?.value.trim();
    if (!url) { if (fmtSpan) fmtSpan.textContent = '—'; return; }
    const fmt = getFormatLabel(url);
    if (fmtSpan) fmtSpan.textContent = fmt;
    // Auto-fill title from URL if empty
    if (titleInput && !titleInput.value.trim()) {
      const guessed = url.split('/').pop().split('?')[0].replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').trim();
      if (guessed.length > 1) titleInput.value = guessed;
    }
  });

  // Form submit — add a new video
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const url   = urlInput?.value.trim();
    const title = titleInput?.value.trim() || 'Untitled Stream';
    const thumb = thumbInput?.value.trim() || null;
    const desc  = descInput?.value.trim() || '';

    if (!url) {
      EventBus.emit(EVENTS.TOAST, { msg: '⚠ Please enter a valid URL' });
      return;
    }

    const videos = getAdminVideos();
    const fmt    = getFormatLabel(url);
    const id     = 'admin-' + Date.now();

    videos.unshift({ id, title, src: url, thumbnail: thumb, description: desc, format: fmt, duration: '--', tags: ['custom'] });
    saveAdminVideos(videos);

    form.reset();
    if (fmtSpan) fmtSpan.textContent = '—';

    renderList();
    EventBus.emit(EVENTS.TOAST, { msg: `✓ "${title}" added to library` });
    EventBus.emit('admin:updated', {});
  });

  // Refresh list whenever the admin panel is opened
  EventBus.on(EVENTS.PANEL_OPEN, (panelId) => {
    if (panelId === 'admin-panel') renderList();
  });

  // Initial render
  renderList();

  function renderList() {
    if (!listEl) return;
    const videos = getAdminVideos();

    if (!videos.length) {
      listEl.innerHTML = `<p class="admin-empty">No custom streams yet. Add one above.</p>`;
      return;
    }

    listEl.innerHTML = videos.map(v => `
      <div class="admin-item" data-id="${v.id}">
        <div class="admin-item-info">
          <span class="admin-item-fmt">${v.format || 'STREAM'}</span>
          <p class="admin-item-title">${esc(v.title)}</p>
          <p class="admin-item-url">${esc(v.src)}</p>
        </div>
        <button class="admin-delete-btn" data-id="${v.id}" aria-label="Remove">✕</button>
      </div>
    `).join('');

    listEl.querySelectorAll('.admin-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const updated = getAdminVideos().filter(v => v.id !== btn.dataset.id);
        saveAdminVideos(updated);
        renderList();
        EventBus.emit('admin:updated', {});
        EventBus.emit(EVENTS.TOAST, { msg: '✓ Stream removed' });
      });
    });
  }
}

function esc(str) {
  return (str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
