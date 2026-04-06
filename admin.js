import { getFormatLabel } from './modules/video/player.js';
import { addAdminVideo, getAdminVideos, removeAdminVideo } from './modules/video/admin.js';

const ADMIN_ID = 'mahfoooozzzz';
const ADMIN_PASS = 'm@hfooz1199';

const loginView = document.getElementById('login-view');
const adminView = document.getElementById('admin-view');
const loginForm = document.getElementById('login-form');
const adminIdInput = document.getElementById('admin-id');
const adminPassInput = document.getElementById('admin-pass');
const form = document.getElementById('admin-form');
const urlInput = document.getElementById('admin-url');
const titleInput = document.getElementById('admin-title');
const thumbInput = document.getElementById('admin-thumb');
const descInput = document.getElementById('admin-desc');
const detectBtn = document.getElementById('detect-btn');
const fmtSpan = document.getElementById('detected-format');
const listEl = document.getElementById('admin-list');

function isAuthed() {
  return sessionStorage.getItem('streamer-pro-admin-auth') === '1';
}

function setAuthed() {
  sessionStorage.setItem('streamer-pro-admin-auth', '1');
  showAdmin();
}

async function showAdmin() {
  if (loginView) loginView.style.display = 'none';
  if (adminView) adminView.style.display = 'block';
  await render();
}

function showLogin() {
  if (loginView) loginView.style.display = 'block';
  if (adminView) adminView.style.display = 'none';
}

async function render() {
  const videos = await getAdminVideos();
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
    btn.addEventListener('click', async () => {
      await removeAdminVideo(btn.dataset.id);
      await render();
    });
  });
}

function updateFormat() {
  const url = urlInput.value.trim();
  fmtSpan.textContent = url ? getFormatLabel(url) : '—';
}

loginForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const id = adminIdInput.value.trim();
  const pass = adminPassInput.value;
  if (id === ADMIN_ID && pass === ADMIN_PASS) {
    setAuthed();
  } else {
    alert('Invalid admin ID or password');
  }
});

detectBtn?.addEventListener('click', updateFormat);
urlInput?.addEventListener('input', updateFormat);
form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!isAuthed()) return;
  const url = urlInput.value.trim();
  if (!url) return;
  const title = titleInput.value.trim() || 'Untitled Stream';
  const video = {
    title,
    src: url,
    thumbnail: thumbInput.value.trim() || null,
    description: descInput.value.trim() || '',
    format: getFormatLabel(url),
    duration: '--',
    tags: ['custom'],
  };
  await addAdminVideo(video);
  form.reset();
  fmtSpan.textContent = '—';
  await render();
});

function escapeHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

if (isAuthed()) showAdmin(); else showLogin();
