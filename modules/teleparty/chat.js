/**
 * Teleparty Chat — Renders and manages the chat UI.
 */
import { EventBus, EVENTS } from '../utils/eventBus.js';
import { getState } from '../utils/state.js';
import { sendChatMsg } from './client.js';

export function initChat() {
  const messagesEl = document.getElementById('chat-messages');
  const inputEl    = document.getElementById('chat-input');
  const sendBtn    = document.getElementById('send-chat-btn');

  // Receive chat messages
  EventBus.on(EVENTS.PARTY_CHAT, ({ user, text, system }) => {
    if (!messagesEl) return;
    const isMe = user === getState('party.userId');

    const el = document.createElement('div');
    el.className = `chat-message${system ? ' system' : ''}`;

    if (system) {
      el.textContent = text;
    } else {
      el.innerHTML = `<div class="chat-user">${isMe ? 'You' : user?.slice(0, 6) || 'User'}</div>${escapeHtml(text)}`;
    }

    messagesEl.appendChild(el);
    // Auto-scroll to bottom
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });

  // Send button
  sendBtn?.addEventListener('click', sendMsg);
  inputEl?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); sendMsg(); } });

  function sendMsg() {
    const text = inputEl?.value.trim();
    if (!text) return;
    sendChatMsg(text);
    inputEl.value = '';
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
