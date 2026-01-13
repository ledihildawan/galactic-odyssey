import GalacticAudio from './src/core/AudioEngine.js';
import EventBus from './src/core/EventBus.js';
import GridArchitect from './src/engines/GridArchitect.js';
import { showToast } from './src/ui/Toast.js';

EventBus.on('app:booted', (payload) => {
  showToast('Expedition Navigation Systems Online', 1500);
});

window.addEventListener('DOMContentLoaded', () => {
  new GalacticAudio();
  // Bootstrap the app
  new GridArchitect();
});
