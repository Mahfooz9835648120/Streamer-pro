/**
 * Playlist — mix of backend-proxied tracks + free live internet radio streams.
 * Live streams: SomaFM (free, no auth required, 128k MP3).
 * Proxied tracks: /api/audio/:id adds CORS headers for Web Audio API analyser.
 */
export const playlist = [
  // ── Live Internet Radio (SomaFM) ──────────────────────────────────────────
  {
    title:    'Groove Salad',
    artist:   'SomaFM · Ambient Electronic',
    src:      'https://ice1.somafm.com/groovesalad-128-mp3',
    cover:    null,
    duration: 'LIVE',
    live:     true,
  },
  {
    title:    'Drone Zone',
    artist:   'SomaFM · Atmospheric Drone',
    src:      'https://ice1.somafm.com/dronezone-128-mp3',
    cover:    null,
    duration: 'LIVE',
    live:     true,
  },
  {
    title:    'Space Station',
    artist:   'SomaFM · Space Ambient',
    src:      'https://ice1.somafm.com/spacestation-128-mp3',
    cover:    null,
    duration: 'LIVE',
    live:     true,
  },
  {
    title:    'Lush',
    artist:   'SomaFM · Sensuous Female Vocals',
    src:      'https://ice2.somafm.com/lush-128-mp3',
    cover:    null,
    duration: 'LIVE',
    live:     true,
  },
  {
    title:    'Underground 80s',
    artist:   'SomaFM · New Wave & Synth',
    src:      'https://ice2.somafm.com/u80s-128-mp3',
    cover:    null,
    duration: 'LIVE',
    live:     true,
  },
  {
    title:    'Indie Pop Rocks',
    artist:   'SomaFM · Indie Pop',
    src:      'https://ice1.somafm.com/indiepop-128-mp3',
    cover:    null,
    duration: 'LIVE',
    live:     true,
  },

  // ── Proxied Demo Tracks ───────────────────────────────────────────────────
  {
    title:    'Midnight Frequencies',
    artist:   'LoFi Collective',
    src:      '/api/audio/1',
    cover:    null,
    duration: '3:22',
    live:     false,
  },
  {
    title:    'Glass Horizon',
    artist:   'Neon Static',
    src:      '/api/audio/2',
    cover:    null,
    duration: '4:06',
    live:     false,
  },
  {
    title:    'Zero Gravity',
    artist:   'Void Signal',
    src:      '/api/audio/3',
    cover:    null,
    duration: '2:54',
    live:     false,
  },
  {
    title:    'Digital Rainfall',
    artist:   'Ambient Circuits',
    src:      '/api/audio/4',
    cover:    null,
    duration: '3:41',
    live:     false,
  },
  {
    title:    'Monochrome Pulse',
    artist:   'Static Wave',
    src:      '/api/audio/5',
    cover:    null,
    duration: '4:15',
    live:     false,
  },
  {
    title:    'Orbit Decay',
    artist:   'Deep Signal',
    src:      '/api/audio/6',
    cover:    null,
    duration: '3:58',
    live:     false,
  },
];
