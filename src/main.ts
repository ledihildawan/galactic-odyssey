import GalacticAudio from './core/AudioEngine';
import EventBus from './core/EventBus';
import GridArchitect from './engines/GridArchitect';
import { showToast } from './ui/Toast';

EventBus.on('app:booted', (payload: any) => {
  showToast('Expedition Navigation Systems Online', 1500);
});

(function setupPowerSavingMode() {
  let powerSavingMode = false;

  function setPowerSavingMode(enable: boolean) {
    powerSavingMode = !!enable;
    EventBus.emit('powerSaving:changed', { enabled: powerSavingMode });
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

  EventBus.on('powerSaving:changed', ({ enabled }: any) => {
    EventBus.emit('audio:setEnabled', !enabled);
    EventBus.emit('animation:setEnabled', !enabled);
    document.documentElement.classList.toggle('powersave', enabled);
    showToast(enabled ? 'Power Saving Mode Activated' : 'Power Saving Mode Disabled', 1800);
  });
})();

window.addEventListener('DOMContentLoaded', () => {
  new GalacticAudio();
  new GridArchitect();
});
