/**
 * Minimal synchronous event emitter for repository change notifications.
 * Lets services (e.g. reminder sync) react to data changes without repositories
 * importing native or UI code.
 */
export class ChangeEmitter<T> {
  private listeners: Set<(event: T) => void> = new Set();

  subscribe(listener: (event: T) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: T): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.warn('[ChangeEmitter] listener failed:', err);
      }
    });
  }
}
