import GalacticAudio from './src/core/AudioEngine.js';
import EventBus from './src/core/EventBus.js';
import GridArchitect from './src/engines/GridArchitect.js';
import { showToast } from './src/ui/Toast.js';

EventBus.on('app:booted', (payload) => {
  showToast('Expedition Navigation Systems Online', 1500);
});

(function setupPowerSavingMode() {
(function setupPowerSavingMode() {
  let powerSavingMode = false;

  function setPowerSavingMode(enable) {
    powerSavingMode = !!enable;
    EventBus.emit('powerSaving:changed', { enabled: powerSavingMode });
  }

  window.enablePowerSavingMode = setPowerSavingMode;

  // Aktifkan otomatis saat tab tidak terlihat atau window blur
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      setPowerSavingMode(document.hidden);
    });
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('blur', () => setPowerSavingMode(true));
    window.addEventListener('focus', () => setPowerSavingMode(false));
  }

  // Sinkronisasi efek mode hemat daya
  EventBus.on('powerSaving:changed', ({ enabled }) => {
    // Sinkronisasi audio, animasi, CSS, dan info user
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
