import EventBus from '.';
import { showToast } from '../ui/Toast';
import { EVENT_KEYS, STORAGE_KEYS } from './Keys';

let powerSavingMode = false;

function setPowerSavingMode(enable: boolean) {
  powerSavingMode = !!enable;
  EventBus.emit(EVENT_KEYS.POWER_SAVING_CHANGED, { enabled: powerSavingMode });
}

document.addEventListener('visibilitychange', () => setPowerSavingMode(document.hidden));
window.addEventListener('blur', () => setPowerSavingMode(true));
window.addEventListener('focus', () => setPowerSavingMode(false));

EventBus.on(EVENT_KEYS.POWER_SAVING_CHANGED, ({ enabled }: { enabled: boolean }) => {
  const saved = localStorage.getItem(STORAGE_KEYS.AUDIO_ENABLED);
  const userAudioEnabled = saved !== 'false';

  if (enabled) {
    EventBus.emit(EVENT_KEYS.AUDIO_SET_ENABLED, false);
    EventBus.emit(EVENT_KEYS.ANIMATION_SET_ENABLED, false);
    document.documentElement.classList.add('powersave');
    showToast('Power Saving Mode Activated', 1800);
  } else {
    EventBus.emit(EVENT_KEYS.AUDIO_SET_ENABLED, userAudioEnabled);
    EventBus.emit(EVENT_KEYS.ANIMATION_SET_ENABLED, true);
    document.documentElement.classList.remove('powersave');
    showToast('Power Saving Mode Disabled', 1800);
  }
});

export { setPowerSavingMode };
