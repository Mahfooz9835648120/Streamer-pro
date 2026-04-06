const STORAGE_KEY = 'streamer-pro:admin-videos';

export async function getAdminVideos() {
  try {
    const res = await fetch('/api/admin/videos');
    if (res.ok) {
      const data = await res.json();
      return data.videos || [];
    }
  } catch {}
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export async function saveAdminVideos(videos) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(videos));
  for (const video of videos) {
    await fetch('/api/admin/videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(video),
    }).catch(() => {});
  }
}

export async function addAdminVideo(video) {
  const res = await fetch('/api/admin/videos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(video),
  });
  const data = await res.json();
  const videos = await getAdminVideos();
  videos.unshift(data);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(videos));
  return data;
}

export async function removeAdminVideo(id) {
  await fetch(`/api/admin/videos/${id}`, { method: 'DELETE' }).catch(() => {});
  const videos = (await getAdminVideos()).filter(v => v.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(videos));
}
