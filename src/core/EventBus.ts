import { EventMap, TypedEventHandler } from '../types/index';
import { CoreEvents } from './events';

export class EventBus<Events extends EventMap = CoreEvents> extends EventTarget {
  private _listeners = new Map<keyof Events, Map<TypedEventHandler<any>, EventListener>>();

  constructor() {
    super();
  }

  on<K extends keyof Events>(event: K, handler: TypedEventHandler<Events[K]>) {
    const eventName = event as unknown as string;

    const listener: EventListener = (ev: Event) => {
      const customEvent = ev as CustomEvent<Events[K]>;
      try {
        handler(customEvent.detail);
      } catch (err) {
        console.error(`Error in event handler for "${eventName}":`, err);
      }
    };

    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Map());
    }

    this._listeners.get(event)!.set(handler as TypedEventHandler<any>, listener);
    this.addEventListener(eventName, listener);
    return () => this.off(event, handler);
  }

  off<K extends keyof Events>(event: K, handler?: TypedEventHandler<Events[K]>) {
    const eventName = event as unknown as string;
    const handlers = this._listeners.get(event);

    if (!handlers) return;

    if (handler) {
      const listener = handlers.get(handler as TypedEventHandler<any>);
      if (listener) {
        this.removeEventListener(eventName, listener);
        handlers.delete(handler as TypedEventHandler<any>);
      }
    } else {
      for (const listener of handlers.values()) {
        this.removeEventListener(eventName, listener);
      }
      handlers.clear();
    }

    if (handlers.size === 0) {
      this._listeners.delete(event);
    }
  }

  once<K extends keyof Events>(event: K, handler: TypedEventHandler<Events[K]>) {
    const onceWrapper: TypedEventHandler<Events[K]> = (payload) => {
      handler(payload);
      this.off(event, handler);
    };

    return this.on(event, onceWrapper);
  }

  emit<K extends keyof Events>(event: K, payload?: Events[K]) {
    const eventName = event as unknown as string;
    if (typeof CustomEvent === 'undefined') {
      console.warn('CustomEvent is not defined in this environment');
      return false;
    }
    return this.dispatchEvent(new CustomEvent(eventName, { detail: payload }));
  }
}

// Default singleton instance kept for backward compatibility with existing imports
const bus = new EventBus<CoreEvents>();
export default bus;
