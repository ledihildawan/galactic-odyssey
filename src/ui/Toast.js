import EventBus from '../core/EventBus.js';
import { debounce } from '../utils/helpers.js';

const _display = debounce((msg, timeout = 2500) => {
  const t = document.getElementById('toast');
  if (!t) return;
  t.innerText = msg;
  t.classList.add('active');
  if (t._toastTimer) clearTimeout(t._toastTimer);
  t._toastTimer = setTimeout(() => t.classList.remove('active'), timeout);
}, 50);

EventBus.on('toast:show', (payload = {}) => {
  const { msg, timeout } = typeof payload === 'string' ? { msg: payload } : payload;
  if (msg) _display(msg, timeout);
});

export function showToast(msg, timeout = 2500) {
  EventBus.emit('toast:show', { msg, timeout });
}
