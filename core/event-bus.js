/**
 * event-bus.js — Bus de eventos en proceso para desacoplar módulos FORGE
 */

export class EventBus {
  constructor() {
    this.handlers = new Map();
  }

  /** @param {string} event @param {Function} handler */
  on(event, handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, []);
    this.handlers.get(event).push(handler);
  }

  /** @param {string} event @param {Function} handler */
  off(event, handler) {
    const hs = this.handlers.get(event);
    if (!hs) return;
    const idx = hs.indexOf(handler);
    if (idx >= 0) hs.splice(idx, 1);
  }

  /** @param {string} event @param {unknown} payload */
  async emit(event, payload) {
    const hs = this.handlers.get(event) ?? [];
    await Promise.all(
      hs.map(h =>
        Promise.resolve()
          .then(() => h(payload))
          .catch(err => {
            process.stderr.write(`[forge/event-bus] Error en listener de "${event}": ${err?.message ?? err}\n`);
          })
      )
    );
  }

  /** @param {string} event @param {Function} handler */
  once(event, handler) {
    const wrapper = async (payload) => {
      this.off(event, wrapper);
      await handler(payload);
    };
    this.on(event, wrapper);
  }

  /** @param {string} [event] */
  clear(event) {
    if (event) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
    }
  }

  /** @param {string} event @returns {number} */
  listenerCount(event) {
    return this.handlers.get(event)?.length ?? 0;
  }
}

/** Singleton de proceso */
export const bus = new EventBus();
