type Handler = (payload?: any) => void;

export class EventBus {
  private handlers = new Map<string, Set<Handler>>();

  on(event: string, h: Handler) {
    const set = this.handlers.get(event) ?? new Set();
    set.add(h);
    this.handlers.set(event, set);
    return () => this.off(event, h);
  }

  off(event: string, h: Handler) {
    const set = this.handlers.get(event);
    if (!set) return;
    set.delete(h);
    if (set.size === 0) this.handlers.delete(event);
  }

  emit(event: string, payload?: any) {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const h of Array.from(set)) {
      try {
        h(payload);
      } catch (e) {
        // handlers should guard their own errors
        // swallow to avoid breaking other handlers
      }
    }
  }
}

export const globalEventBus = new EventBus();
