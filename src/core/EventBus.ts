import { EventHandler, EventPayload, IEventBus } from '../types/index';

class EventBus extends EventTarget implements IEventBus {
  private _map: Map<string, Map<EventHandler, EventListener>>;

  constructor() {
    super();
    this._map = new Map();
  }

  on(event: string, handler: EventHandler) {
    const listener: EventListener = (ev: Event) => {
      const detail = (ev as CustomEvent).detail;
      try {
        handler(detail);
      } catch (err) {
        setTimeout(() => {
          throw err;
        });
      }
    };
    if (!this._map.has(event)) this._map.set(event, new Map());
    this._map.get(event)!.set(handler, listener);
    this.addEventListener(event, listener);
    return () => this.off(event, handler);
  }

  off(event: string, handler?: EventHandler) {
    const handlers = this._map.get(event);
    if (!handlers) return;
    if (!handler) {
      for (const l of handlers.values()) {
        this.removeEventListener(event, l);
      }
      this._map.delete(event);
      return;
    }
    const listener = handlers.get(handler);
    if (!listener) return;
    this.removeEventListener(event, listener);
    handlers.delete(handler);
    if (handlers.size === 0) this._map.delete(event);
  }

  once(event: string, handler: EventHandler) {
    const listener: EventListener = (ev: Event) => {
      const detail = (ev as CustomEvent).detail;
      try {
        handler(detail);
      } catch (err) {
        setTimeout(() => {
          throw err;
        });
      }
      // cleanup mapping after invocation
      const handlers = this._map.get(event);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) this._map.delete(event);
      }
    };
    if (!this._map.has(event)) this._map.set(event, new Map());
    this._map.get(event)!.set(handler, listener);
    this.addEventListener(event, listener, { once: true });
    return () => this.off(event, handler);
  }

  emit(event: string, payload?: EventPayload) {
    try {
      return this.dispatchEvent(new CustomEvent(event, { detail: payload }));
    } catch (err) {
      setTimeout(() => {
        throw err;
      });
      return false;
    }
  }
}

const bus = new EventBus();
export default bus;
