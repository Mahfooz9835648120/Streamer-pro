import { getFormatLabel } from './modules/video/player.js';
import { addAdminVideo, getAdminVideos, removeAdminVideo } from './modules/video/admin.js';

const form = document.getElementById('admin-form');
const urlInput = document.getElementById('admin-url');
const titleInput = document.getElementById('admin-title');
const thumbInput = document.getElementById('admin-thumb');
const descInput = document.getElementById('admin-desc');
const detectBtn = document.getElementById('detect-btn');
const fmtSpan = document.getElementById('detected-format');
const listEl = document.getElementById('admin-list');

function render() {
  const videos = getAdminVideos();
  if (!listEl) return;
  if (!videos.length) {
    listEl.innerHTML = '<div class="small">No streams saved yet.</div>';
    return;
  }
  listEl.innerHTML = videos.map(v => `
    <div class="item">
      <div class="meta">
        <div class="fmt">${v.format || 'STREAM'}</div>
        <div class="name">${escapeHtml(v.title || 'Untitled')}</div>
        <div class="url">${escapeHtml(v.src)}</div>
      </div>
      <button data-id="${v.id}" class="remove-btn">Remove</button>
    </div>
  `).join('');
  listEl.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      removeAdminVideo(btn.dataset.id);
      render();
    });
  });
}

function updateFormat() {
  const url = urlInput.value.trim();
  fmtSpan.textContent = url ? getFormatLabel(url) : '—';
}

detectBtn?.addEventListener('click', updateFormat);
urlInput?.addEventListener('blur', updateFormat);
form?.addEventListener('submit', (e) => {
  e.preventDefault();
  const url = urlInput.value.trim();
  if (!url) return;
  const title = titleInput.value.trim() || 'Untitled Stream';
  const video = {
    id: 'admin-' + Date.now(),
    title,
    src: url,
    thumbnail: thumbInput.value.trim() || null,
    description: descInput.value.trim() || '',
    format: getFormatLabel(url),
    duration: '--',
    tags: ['custom'],
  };
  addAdminVideo(video);
  form.reset();
  fmtSpan.textContent = '—';
  render();
});

function escapeHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

render();