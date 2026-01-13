import EventBus from './core';
import GalacticAudio from './core/AudioEngine';
import { EVENT_KEYS } from './core/Keys';
import GridArchitect from './engines/GridArchitect';
import { showToast } from './ui/Toast';

EventBus.on(EVENT_KEYS.APP_BOOTED, (payload: any) => {
  showToast('Expedition Navigation Systems Online', 1500);
});

(function setupPowerSavingMode() {
  let powerSavingMode = false;

  function setPowerSavingMode(enable: boolean) {
    powerSavingMode = !!enable;
    EventBus.emit(EVENT_KEYS.POWER_SAVING_CHANGED, { enabled: powerSavingMode });
  }

  (window as any).enablePowerSavingMode = setPowerSavingMode;

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      setPowerSavingMode(document.hidden);
    });
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('blur', () => setPowerSavingMode(true));
    window.addEventListener('focus', () => setPowerSavingMode(false));
  }

  EventBus.on(EVENT_KEYS.POWER_SAVING_CHANGED, ({ enabled }) => {
    EventBus.emit(EVENT_KEYS.AUDIO_SET_ENABLED, !enabled);
    EventBus.emit(EVENT_KEYS.ANIMATION_SET_ENABLED, !enabled);
    document.documentElement.classList.toggle('powersave', enabled);
    showToast(enabled ? 'Power Saving Mode Activated' : 'Power Saving Mode Disabled', 1800);
  });
})();

window.addEventListener('DOMContentLoaded', () => {
  new GalacticAudio();
  new GridArchitect();
});
