export type EventPayload = any;
export type EventHandler = (payload?: EventPayload) => void;
export type EventMap = Record<string, any>;
export type TypedEventHandler<T = any> = (payload: T) => void;

export interface IEventBus {
  on(event: string, handler: EventHandler): () => void;
  off(event: string, handler?: EventHandler): void;
  once(event: string, handler: EventHandler): () => void;
  emit(event: string, payload?: EventPayload): boolean;
}

export interface OdysseyAudioConfig {
  basePath: string;
  masterVolume: number;
  ambientBaseVolume: number;
  idleInterval: [number, number];
  idleDelay: number;
}

export interface OdysseyConfigShape {
  temporal: {
    weekStart: number;
    totalYears: number;
    monthsShort: string[];
    daysShort: string[];
  };
  display: { defaultMode: string; centerContent: boolean; minCols: number; warpDuration: number };
  audio: OdysseyAudioConfig;
  physics: { cursorInertia: number; hoverThrottle: number; exhaustThreshold: number };
}
