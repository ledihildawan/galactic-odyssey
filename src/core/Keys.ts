export const EVENT_KEYS = {
  AUDIO_PLAY: 'audio:play',
  AUDIO_TOGGLE_MASTER: 'audio:toggleMaster',
  AUDIO_TOGGLED: 'audio:toggled',
  AUDIO_SET_BUSY: 'audio:setBusy',
  AUDIO_INJECT_ENGINE_POWER: 'audio:injectEnginePower',
  AUDIO_UPDATE_SPATIAL_POSITION: 'audio:updateSpatialPosition',
  AUDIO_RESET_IDLE_TIMER: 'audio:resetIdleTimer',
  AUDIO_SET_ENABLED: 'audio:setEnabled',
  POWER_SAVING_CHANGED: 'powerSaving:changed',
  TOAST_SHOW: 'toast:show',
  APP_BOOTED: 'app:booted',
  ANIMATION_SET_ENABLED: 'animation:setEnabled',
  STATE_RESTORED: 'state:restored',
  STATE_WARP: 'state:warp',
  STATE_SAVED: 'state:saved',
  NAV_WARP_START: 'nav:warp:start',
  NAV_WARP_END: 'nav:warp:end',
  NAV_SCROLL_START: 'nav:scroll:start',
  NAV_SCROLL_END: 'nav:scroll:end',
  NAV_MODE_CHANGED: 'nav:modeChanged',
  UI_THEME_CHANGED: 'ui:themeChanged',
  INPUT_POINTER_MOVE: 'input:pointerMove',
  INPUT_HOVER: 'input:hover',
  INPUT_CLICK: 'input:click',
};

export const STORAGE_KEYS = {
  AUDIO_ENABLED: 'audio_enabled',
  ODYSSEY_STATE: 'odyssey_state',
  THEME: 'theme',
};

export default { EVENT_KEYS, STORAGE_KEYS };
