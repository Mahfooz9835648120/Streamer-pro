/**
 * Streamer Pro — Express + WebSocket backend server.
 * In production, serves the Vite-built frontend from /dist.
 */
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { initSocket } from './socket.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8080;
const isProd = process.env.NODE_ENV === 'production';

app.use(cors({ origin: '*' }));
app.use(express.json());

let adminVideos = [];

app.get('/api/admin/videos', (req, res) => {
  res.json({ videos: adminVideos });
});

app.post('/api/admin/videos', (req, res) => {
  const { title, src, thumbnail, description, format, duration, tags } = req.body;
  if (!src) return res.status(400).json({ error: 'src is required' });
  const video = { id: 'admin-' + Date.now() + '-' + Math.random().toString(16).slice(2), title: title || 'Untitled', src, thumbnail: thumbnail || null, description: description || '', format: format || 'STREAM', duration: duration || '--', tags: tags || ['custom'] };
  adminVideos.unshift(video);
  res.status(201).json(video);
});

app.delete('/api/admin/videos/:id', (req, res) => {
  const before = adminVideos.length;
  adminVideos = adminVideos.filter(v => v.id !== req.params.id);
  if (adminVideos.length === before) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

app.get('/api/audio/:id', async (req, res) => {
  const sources = [
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
  ];
  const idx = parseInt(req.params.id, 10) - 1;
  const url = sources[idx] || sources[0];
  try {
    const upstream = await fetch(url, { headers: { Range: req.headers.range || '' } });
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Accept-Ranges', 'bytes');
    if (upstream.headers.get('content-length')) res.setHeader('Content-Length', upstream.headers.get('content-length'));
    if (upstream.headers.get('content-range')) res.setHeader('Content-Range', upstream.headers.get('content-range'));
    res.status(upstream.status);
    const reader = upstream.body.getReader();
    const pump = () => reader.read().then(({ done, value }) => { if (done) { res.end(); return; } res.write(Buffer.from(value)); pump(); }).catch(() => res.end());
    pump();
  } catch (err) {
    res.status(502).json({ error: 'Audio proxy error', detail: err.message });
  }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: Date.now() }));

app.get('/api/content', (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  const allVideos = [...adminVideos, ...DEMO_VIDEOS];
  const videos = allVideos.filter(v => !q || v.title.toLowerCase().includes(q) || v.tags?.some(t => t.includes(q)));
  res.json({ videos });
});

app.get('/api/content/:id', (req, res) => {
  const all = [...adminVideos, ...DEMO_VIDEOS];
  const video = all.find(v => v.id === req.params.id);
  if (!video) return res.status(404).json({ error: 'Not found' });
  res.json(video);
});

if (isProd) {
  const distPath = path.join(__dirname, '..', 'dist');
  const hasDist = fs.existsSync(path.join(distPath, 'index.html'));
  const staticRoot = hasDist ? distPath : path.join(__dirname, '..');
  app.use(express.static(staticRoot));
  app.get(['/admin', '/admin.html'], (req, res) => {
    res.sendFile(path.join(staticRoot, 'admin.html'));
  });
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/ws')) {
      res.sendFile(path.join(staticRoot, 'index.html'));
    }
  });
}

const server = createServer(app);
initSocket(server);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[StreamerPro] Server listening on http://0.0.0.0:${PORT}`);
});

const DEMO_VIDEOS = [
  { id: 'v1', title: 'Big Buck Bunny', src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', thumbnail: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg', duration: '9:56', format: 'MP4', tags: ['animation', 'short film'] },
  { id: 'v2', title: 'Elephant Dream', src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', thumbnail: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg', duration: '10:54', format: 'MP4', tags: ['animation', 'sci-fi'] },
  { id: 'v3', title: 'HLS Demo Stream', src: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', thumbnail: null, duration: 'Live', format: 'HLS', tags: ['live', 'adaptive'] },
];

export { DEMO_VIDEOS };
