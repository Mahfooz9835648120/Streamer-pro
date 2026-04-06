/**
 * Audio Visualizer — Canvas-based frequency bars using Web Audio API analyser.
 * Fixed: DPR scaling is baked into canvas dimensions, not ctx transforms,
 * so setTransform() resets don't break the scale each frame.
 */
import { getState } from '../utils/state.js';

let canvas, ctx, analyser;
let animId = null;
let dpr = 1;

export function initVisualizer(analyserNode) {
  canvas  = document.getElementById('visualizer');
  analyser = analyserNode;
  if (!canvas || !analyser) return;

  ctx = canvas.getContext('2d');
  dpr = window.devicePixelRatio || 1;
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas, { passive: true });

  if (animId) cancelAnimationFrame(animId);
  draw();
}

function resizeCanvas() {
  if (!canvas) return;
  dpr = window.devicePixelRatio || 1;
  // Physical pixels = CSS pixels × dpr
  canvas.width  = Math.round(canvas.offsetWidth  * dpr);
  canvas.height = Math.round(canvas.offsetHeight * dpr);
  // No ctx.scale() here — draw() uses canvas.width/height directly
}

function draw() {
  animId = requestAnimationFrame(draw);
  if (!ctx || !analyser || !canvas) return;

  // Work in physical pixel space (canvas.width × canvas.height)
  const W = canvas.width;
  const H = canvas.height;

  const bufLen  = analyser.frequencyBinCount;
  const dataArr = new Uint8Array(bufLen);
  analyser.getByteFrequencyData(dataArr);

  ctx.clearRect(0, 0, W, H);

  const isPlaying = getState('music.isPlaying');
  const barCount  = getState('perf.isLowEnd') ? 24 : 48;
  const step      = Math.max(1, Math.floor(bufLen / barCount));
  const gap       = Math.round(dpr);
  const barW      = Math.floor((W - gap * (barCount - 1)) / barCount);

  for (let i = 0; i < barCount; i++) {
    const value = dataArr[i * step] / 255;
    const barH  = Math.max(2, value * H * 0.88);
    const alpha = isPlaying ? (0.3 + value * 0.7) : 0.1;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    const x = i * (barW + gap);
    const y = H - barH;
    // Rounded tops
    ctx.beginPath();
    const r = Math.min(barW / 2, 3 * dpr);
    ctx.roundRect(x, y, barW, barH, [r, r, 0, 0]);
    ctx.fill();
  }

  // Reflection (save/restore so transforms don't accumulate)
  ctx.save();
  ctx.scale(1, -1);
  ctx.translate(0, -H);
  ctx.globalAlpha = 0.12;
  for (let i = 0; i < barCount; i++) {
    const value = dataArr[i * step] / 255;
    const barH  = Math.max(1, value * H * 0.28);
    const x = i * (barW + gap);
    const y = H - barH;
    ctx.fillStyle = `rgba(255,255,255,${0.2 + value * 0.4})`;
    ctx.fillRect(x, y, barW, barH);
  }
  ctx.restore();
}

export function stopVisualizer() {
  if (animId) { cancelAnimationFrame(animId); animId = null; }
}
