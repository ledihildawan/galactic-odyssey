import bus from './EventBus.js';

export const GlobalState = {
  isWarping: false,
  currentYear: 2024,
  theme: 'dark',
  audioEnabled: false,

  // Fungsi untuk update yang akan mentrigger reaksi di UI/Engine
  setWarping(val) {
    this.isWarping = val;
    bus.emit('state:warp', val);
  }
};

export default GlobalState;
