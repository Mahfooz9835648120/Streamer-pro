/**
 * Video Library — Fetches content from backend API and renders cards.
 * Merges public server videos with admin-added public streams.
 */
import { EventBus, EVENTS } from '../utils/eventBus.js';
import { getState, loadHistory, saveHistory } from '../utils/state.js';
import { loadVideo } from './player.js';
import { getAdminVideos } from './admin.js';

let allVideos = [];

export async function initLibrary() {
  loadHistory();
  await fetchVideos();
  renderLibrary(allVideos);
  renderHistory();

  const searchInput = document.getElementById('video-search');
  let searchTimer = null;
  searchInput?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const q = searchInput.value.trim().toLowerCase();
      const filtered = q
        ? allVideos.filter(v => v.title.toLowerCase().includes(q) || v.tags?.some(t => t.includes(q)) || (v.format || '').toLowerCase().includes(q))
        : allVideos;
      renderLibrary(filtered, q);
    }, 300);
  });

  EventBus.on('admin:updated', async () => {
    await fetchVideos();
    renderLibrary(allVideos);
  });

  EventBus.on(EVENTS.PANEL_OPEN, (panelId) => {
    if (panelId === 'history-panel') renderHistory();
  });

  EventBus.on(EVENTS.VIDEO_ENDED, () => renderHistory());
  document.getElementById('clear-history-btn')?.addEventListener('click', () => {
    getState('history').length = 0;
    saveHistory();
    renderHistory();
    EventBus.emit(EVENTS.TOAST, { msg: '✓ History cleared' });
  });
}

async function fetchVideos() {
  try {
    const res = await fetch('/api/content');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const serverVideos = data.videos || [];
    const publicAdminVideos = getAdminVideos();
    allVideos = [...publicAdminVideos, ...serverVideos];
  } catch {
    const publicAdminVideos = getAdminVideos();
    allVideos = [...publicAdminVideos, ...FALLBACK_VIDEOS];
  }
}

function renderLibrary(videos, query = '') {
  const grid = document.getElementById('video-grid');
  if (!grid) return;
  if (!videos.length) {
    grid.innerHTML = `<div class="library-empty">${query ? `No results for "<em>${query}</em>"` : 'No videos available.'}</div>`;
    return;
  }
  const history = getState('history');
  grid.innerHTML = videos.map(v => {
    const hist = history.find(h => h.src === v.src);
    const progress = hist?.duration > 0 ? Math.min(hist.currentTime / hist.duration, 1) : 0;
    const isContinue = progress > 0.05 && progress < 0.95;
    const isAdmin = v.id?.startsWith('admin-');
    return `<div class="video-card${isContinue ? ' continue-watching' : ''}${isAdmin ? ' admin-card' : ''}" data-src="${escapeAttr(v.src)}" data-title="${escapeAttr(v.title)}" data-thumb="${escapeAttr(v.thumbnail || '')}" data-time="${hist?.currentTime || 0}">
      <div class="video-thumb">${v.thumbnail ? `<img src="${escapeAttr(v.thumbnail)}" alt="${escapeAttr(v.title)}" loading="lazy" />` : `<div class="video-thumb-placeholder">▶</div>`}${isContinue ? `<div class="continue-bar"><div class="continue-bar-fill" style="width:${progress * 100}%"></div></div>` : ''}<span class="format-badge">${v.format || 'STREAM'}</span>${isAdmin ? '<span class="admin-badge">Custom</span>' : ''}</div>
      <div class="video-card-body"><p class="video-card-title">${v.title}</p><p class="video-card-meta">${v.duration || '--'}${isContinue ? ' · Continue' : ''}</p></div>
    </div>`;
  }).join('');
  grid.querySelectorAll('.video-card').forEach(card => {
    card.addEventListener('click', () => {
      loadVideo({ src: card.dataset.src, title: card.dataset.title, thumbnail: card.dataset.thumb || null, startTime: parseFloat(card.dataset.time) || 0 });
      document.getElementById('video-player-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function renderHistory() {
  const list = document.getElementById('history-list');
  if (!list) return;
  const history = getState('history');
  if (!history.length) {
    list.innerHTML = `<p style="text-align:center;color:var(--gray-600);font-size:13px">No watch history yet.</p>`;
    return;
  }
  list.innerHTML = history.slice(0, 20).map(h => `<div class="history-item" data-src="${escapeAttr(h.src)}" data-title="${escapeAttr(h.title)}" data-time="${h.currentTime || 0}" data-thumb="${escapeAttr(h.thumbnail || '')}"><div class="history-thumb">${h.thumbnail ? `<img src="${escapeAttr(h.thumbnail)}" alt="" />` : '▶'}</div><div class="history-info"><p class="history-title">${h.title || 'Untitled'}</p><p class="history-meta">${new Date(h.visitedAt).toLocaleDateString()}</p></div>${Math.round((h.duration > 0 ? Math.min(h.currentTime / h.duration, 1) : 0) * 100) > 5 ? `<span class="continue-pill">${Math.round((h.duration > 0 ? Math.min(h.currentTime / h.duration, 1) : 0) * 100)}%</span>` : ''}</div>`).join('');
  list.querySelectorAll('.history-item').forEach(el => {
    el.addEventListener('click', () => {
      loadVideo({ src: el.dataset.src, title: el.dataset.title, thumbnail: el.dataset.thumb || null, startTime: parseFloat(el.dataset.time) || 0 });
      document.getElementById('close-history-btn')?.click();
      document.querySelector('.nav-btn[data-mode="video"]')?.click();
    });
  });
}

function escapeAttr(str) {
  return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const FALLBACK_VIDEOS = [
  { id: 'v1', title: 'Big Buck Bunny', src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', thumbnail: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg', duration: '9:56', format: 'MP4', tags: ['animation'] },
  { id: 'v2', title: 'Elephant Dream', src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', thumbnail: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg', duration: '10:54', format: 'MP4', tags: ['animation'] },
  { id: 'v3', title: 'HLS Demo Stream', src: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', thumbnail: null, duration: 'Live', format: 'HLS', tags: ['live'] },
];
