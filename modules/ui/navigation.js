/**
 * Bottom navigation — switches between Video and Music modes.
 */
import { setState } from '../utils/state.js';
import { EventBus, EVENTS } from '../utils/eventBus.js';

export function initNavigation() {
  const navBtns = document.querySelectorAll('.nav-btn');
  const sections = document.querySelectorAll('.mode-section');

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      if (!mode) return;

      // Update active states
      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      sections.forEach(s => {
        s.classList.remove('active');
        if (s.id === `${mode}-mode`) s.classList.add('active');
      });

      setState('mode', mode);
      EventBus.emit(EVENTS.MODE_CHANGE, mode);
    });
  });
}

/**
 * Panel system — teleparty and history panels
 */
export function initPanels() {
  const overlay = document.getElementById('panel-overlay');

  function openPanel(panelId) {
    document.querySelectorAll('.side-panel').forEach(p => p.classList.remove('open'));
    const panel = document.getElementById(panelId);
    if (!panel) return;
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');
    EventBus.emit(EVENTS.PANEL_OPEN, panelId);
  }

  function closeAll() {
    document.querySelectorAll('.side-panel').forEach(p => {
      p.classList.remove('open');
      p.setAttribute('aria-hidden', 'true');
    });
    overlay.classList.remove('visible');
    overlay.setAttribute('aria-hidden', 'true');
    EventBus.emit(EVENTS.PANEL_CLOSE);
  }

  // Teleparty button
  document.getElementById('teleparty-btn')?.addEventListener('click', () => openPanel('teleparty-panel'));
  document.getElementById('close-party-btn')?.addEventListener('click', closeAll);

  // History button
  document.getElementById('history-btn')?.addEventListener('click', () => openPanel('history-panel'));
  document.getElementById('close-history-btn')?.addEventListener('click', closeAll);

  // Admin panel button
  document.getElementById('admin-btn')?.addEventListener('click', () => openPanel('admin-panel'));
  document.getElementById('close-admin-btn')?.addEventListener('click', closeAll);

  // Overlay click closes
  overlay.addEventListener('click', closeAll);

  return { openPanel, closeAll };
}

/** Toast notification system */
export function initToast() {
  const container = document.getElementById('toast-container');

  function show(msg, duration = 2500) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    container.appendChild(el);

    setTimeout(() => {
      el.classList.add('out');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }, duration);
  }

  EventBus.on(EVENTS.TOAST, ({ msg, duration }) => show(msg, duration));
  return { show };
}
