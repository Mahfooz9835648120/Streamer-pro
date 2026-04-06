/**
 * Admin stream storage.
 */
const STORAGE_KEY = 'streamer-pro:admin-videos';

export function getAdminVideos() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveAdminVideos(videos) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(videos));
}

export function addAdminVideo(video) {
  const videos = getAdminVideos();
  videos.unshift(video);
  saveAdminVideos(videos);
}

export function removeAdminVideo(id) {
  const videos = getAdminVideos().filter(v => v.id !== id);
  saveAdminVideos(videos);
}
