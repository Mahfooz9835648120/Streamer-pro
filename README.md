# Streamer-pro

## Deploy (Railway)

This project is configured for Railway deployment via `railway.json`.

- Build command: `npm install && npm run build`
- Start command: `npm start`

### Notes

- The app listens on `process.env.PORT` (already supported in `server/server.js`).
- Frontend build output is generated into `dist/` by `npm run build`.
