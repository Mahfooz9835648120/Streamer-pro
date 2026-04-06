/**
 * Video Library — Fetches content from backend API and renders cards.
 * Merges public server videos with admin-added public streams.
 */
import { EventBus, EVENTS } from '../utils/eventBus.js';
import { getState, loadHistory } from '../utils/state.js';
import { loadVideo } from './player.js';
import { getAdminVideos } from './admin.js';

let allVideos = [];

export async function initLibrary() {
  loadHistory();
  removeHistoryUi();
  await fetchVideos();
  renderLibrary(allVideos);

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
  grid.innerHTML = videos.map(v => {
    const isAdmin = v.id?.startsWith('admin-');
    return `<div class="video-card${isAdmin ? ' admin-card' : ''}" data-src="${escapeAttr(v.src)}" data-title="${escapeAttr(v.title)}" data-thumb="${escapeAttr(v.thumbnail || '')}" data-time="0">
      <div class="video-thumb">${v.thumbnail ? `<img src="${escapeAttr(v.thumbnail)}" alt="${escapeAttr(v.title)}" loading="lazy" />` : `<div class="video-thumb-placeholder">▶</div>`}<span class="format-badge">${v.format || 'STREAM'}</span>${isAdmin ? '<span class="admin-badge">Custom</span>' : ''}</div>
      <div class="video-card-body"><p class="video-card-title">${v.title}</p><p class="video-card-meta">${v.duration || '--'}</p></div>
    </div>`;
  }).join('');
  grid.querySelectorAll('.video-card').forEach(card => {
    card.addEventListener('click', () => {
      if (getState('party.roomId') && !getState('party.isHost')) {
        EventBus.emit(EVENTS.TOAST, { msg: 'Only the room host can change videos.' });
        return;
      }
      loadVideo({ src: card.dataset.src, title: card.dataset.title, thumbnail: card.dataset.thumb || null, startTime: parseFloat(card.dataset.time) || 0 });
      document.getElementById('video-player-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function removeHistoryUi() {
  document.getElementById('history-btn')?.remove();
  document.getElementById('history-panel')?.remove();
}

function escapeAttr(str) {
  return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const FALLBACK_VIDEOS = [
  { id: 'v1', title: 'Big Buck Bunny', src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', thumbnail: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg', duration: '9:56', format: 'MP4', tags: ['animation'] },
  { id: 'v2', title: 'Elephant Dream', src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', thumbnail: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg', duration: '10:54', format: 'MP4', tags: ['animation'] },
  { id: 'v3', title: 'HLS Demo Stream', src: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', thumbnail: null, duration: 'Live', format: 'HLS', tags: ['live'] },
];
