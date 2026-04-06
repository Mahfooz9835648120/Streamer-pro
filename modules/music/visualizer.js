/**
 * Audio Visualizer — Canvas-based frequency bars using Web Audio API analyser.
 */
import { getState } from '../utils/state.js';

let canvas, ctx, analyser;
let animId = null;
let resizeObserver = null;
let visibilityObserver = null;
let isVisible = true;

export function initVisualizer(analyserNode) {
  canvas  = document.getElementById('visualizer');
  analyser = analyserNode;
  if (!canvas || !analyser) return;

  ctx = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas, { passive: true });
  setupVisibilityObservers();

  // Start drawing
  if (animId) cancelAnimationFrame(animId);
  draw();
}

function resizeCanvas() {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(canvas.offsetWidth * dpr));
  const height = Math.max(1, Math.floor(canvas.offsetHeight * dpr));
  if (canvas.width === width && canvas.height === height) return;
  canvas.width = width;
  canvas.height = height;
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
}

function setupVisibilityObservers() {
  if (!canvas) return;
  resizeObserver?.disconnect();
  visibilityObserver?.disconnect();
  if (window.ResizeObserver) {
    resizeObserver = new ResizeObserver(() => resizeCanvas());
    resizeObserver.observe(canvas);
  }

  if (window.IntersectionObserver) {
    visibilityObserver = new IntersectionObserver((entries) => {
      isVisible = !!entries[0]?.isIntersecting;
    }, { threshold: 0.05 });
    visibilityObserver.observe(canvas);
  }
}

function draw() {
  animId = requestAnimationFrame(draw);
  if (!ctx || !analyser) return;
  if (!isVisible || document.hidden) return;

  const W = canvas.offsetWidth;
  const H = canvas.offsetHeight;
  const bufLen = analyser.frequencyBinCount;
  const dataArr = new Uint8Array(bufLen);
  analyser.getByteFrequencyData(dataArr);

  ctx.clearRect(0, 0, W, H);

  const isPlaying = getState('music.isPlaying');
  const barCount  = getState('perf.isLowEnd') ? 24 : 48;
  const step      = Math.floor(bufLen / barCount);
  const barW      = (W / barCount) - 1;

  for (let i = 0; i < barCount; i++) {
    const value = dataArr[i * step] / 255;
    const barH  = value * H * 0.9;

    // Gradient from white to dim gray
    const alpha = isPlaying ? (0.3 + value * 0.7) : 0.08;
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;

    const x = i * (barW + 1);
    const y = H - barH;

    // Rounded top bars (fallback for browsers without roundRect)
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, [2, 2, 0, 0]);
      ctx.fill();
    } else {
      ctx.fillRect(x, y, barW, barH);
    }
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

export function stopVisualizer() {
  if (animId) { cancelAnimationFrame(animId); animId = null; }
  resizeObserver?.disconnect();
  visibilityObserver?.disconnect();
}
