import { EVENT_KEYS } from './Keys';

export interface CoreEvents {
  [EVENT_KEYS.AUDIO_PLAY]: { key: string; options?: { volume?: number; playbackRate?: number; loop?: boolean } };
  [EVENT_KEYS.AUDIO_TOGGLE_MASTER]: void;
  [EVENT_KEYS.AUDIO_TOGGLED]: { enabled: boolean };
  [EVENT_KEYS.AUDIO_SET_BUSY]: boolean;
  [EVENT_KEYS.AUDIO_INJECT_ENGINE_POWER]: number;
  [EVENT_KEYS.AUDIO_UPDATE_SPATIAL_POSITION]: { x: number; y: number };
  [EVENT_KEYS.AUDIO_RESET_IDLE_TIMER]: void;
  [EVENT_KEYS.AUDIO_SET_ENABLED]: boolean;
  [EVENT_KEYS.POWER_SAVING_CHANGED]: { enabled: boolean };
  [EVENT_KEYS.TOAST_SHOW]: { msg: string; timeout?: number };
  [EVENT_KEYS.APP_BOOTED]: any;
  [EVENT_KEYS.ANIMATION_SET_ENABLED]: boolean;
  [EVENT_KEYS.STATE_RESTORED]: any;
  [EVENT_KEYS.STATE_WARP]: any;
  [EVENT_KEYS.STATE_SAVED]: any;
  [EVENT_KEYS.NAV_WARP_START]: { currentYear: number; targetYear: number; distance: number; isInitial?: boolean };
  [EVENT_KEYS.NAV_WARP_END]: { targetYear: number; duration: number };
  [EVENT_KEYS.NAV_SCROLL_START]: { top: number };
  [EVENT_KEYS.NAV_SCROLL_END]: { top: number };
  [EVENT_KEYS.NAV_MODE_CHANGED]: { isRandomMode: boolean };
  [EVENT_KEYS.UI_THEME_CHANGED]: { theme: string };
  [EVENT_KEYS.INPUT_POINTER_MOVE]: { x: number; y: number; velocity: number };
  [EVENT_KEYS.INPUT_HOVER]: { filler: boolean };
  [EVENT_KEYS.INPUT_CLICK]: { x: number; y: number };
}

export default CoreEvents;
