import EventBus from '../core/EventBus';
import { debounce } from '../utils/functionUtils';

const _display = debounce((msg: string, timeout = 2500) => {
  const t = document.getElementById('toast') as HTMLElement | null;
  if (!t) return;
  t.innerText = msg;
  t.classList.add('active');
  if ((t as any)._toastTimer) clearTimeout((t as any)._toastTimer);
  (t as any)._toastTimer = setTimeout(() => t.classList.remove('active'), timeout);
}, 50);

EventBus.on('toast:show', (payload: any = {}) => {
  const { msg, timeout } = typeof payload === 'string' ? { msg: payload } : payload;
  if (msg) _display(msg, timeout);
});

export function showToast(msg: string, timeout = 2500) {
  EventBus.emit('toast:show', { msg, timeout });
}
