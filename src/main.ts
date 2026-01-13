import GalacticAudio from './core/AudioEngine';
import './core/powerSaving';
import GridArchitect from './engines/GridArchitect';

globalThis.addEventListener('DOMContentLoaded', () => {
  new GalacticAudio();
  new GridArchitect();
});
