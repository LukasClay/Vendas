import { EventEmitter } from "events";

export type SseChannel =
  | "sales"
  | "consultora"
  | "users"
  | "products"
  | "consultationSlots";

class SseEmitter extends EventEmitter {}

export const sseEmitter = new SseEmitter();
sseEmitter.setMaxListeners(100);

export function emitSseEvent(channel: SseChannel) {
  sseEmitter.emit("event", channel);
}
