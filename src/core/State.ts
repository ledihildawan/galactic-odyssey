import bus from './EventBus';

export interface GlobalStateShape {
  isWarping: boolean;
  currentYear: number;
  theme: string;
  audioEnabled: boolean;
  setWarping(val: boolean): void;
}

export const GlobalState: GlobalStateShape = {
  isWarping: false,
  currentYear: 2024,
  theme: 'dark',
  audioEnabled: false,

  setWarping(val: boolean) {
    this.isWarping = val;
    bus.emit('state:warp', val);
  },
};

export default GlobalState;
