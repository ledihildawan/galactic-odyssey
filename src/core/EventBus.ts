import { EventHandler, EventPayload, IEventBus } from '../types/index';

class EventBus implements IEventBus {
  private _events: Map<string, Set<EventHandler>>;

  constructor() {
    this._events = new Map();
  }

  on(event: string, handler: EventHandler) {
    if (!this._events.has(event)) this._events.set(event, new Set());
    this._events.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  off(event: string, handler?: EventHandler) {
    if (!this._events.has(event)) return;
    if (!handler) {
      this._events.delete(event);
      return;
    }
    const hs = this._events.get(event)!;
    hs.delete(handler);
    if (hs.size === 0) this._events.delete(event);
  }

  once(event: string, handler: EventHandler) {
    const wrapped = (...args: any[]) => {
      handler(...args);
      this.off(event, wrapped);
    };
    return this.on(event, wrapped);
  }

  emit(event: string, payload?: EventPayload) {
    const hs = this._events.get(event);
    if (!hs) return false;
    for (const h of Array.from(hs)) {
      try {
        h(payload);
      } catch (err) {
        setTimeout(() => {
          throw err;
        });
      }
    }
    return true;
  }
}

const bus = new EventBus();
export default bus;
