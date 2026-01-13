import bus, { EventBus as EventBusClass } from './EventBus';
import { EVENT_KEYS, STORAGE_KEYS } from './Keys';
import { CoreEvents } from './events';

export default bus;
export { EVENT_KEYS, EventBusClass as EventBus, STORAGE_KEYS };
export type { CoreEvents };
