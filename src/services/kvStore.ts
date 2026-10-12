import AsyncStorageModule from '@react-native-async-storage/async-storage';

// Metro gives us the storage API directly; Node (tests via tsx) hands back the CommonJS module object
// with the API under `.default`. Accept both.
const AsyncStorage: typeof AsyncStorageModule =
  typeof (AsyncStorageModule as { getItem?: unknown }).getItem === 'function'
    ? AsyncStorageModule
    : (AsyncStorageModule as unknown as { default: typeof AsyncStorageModule }).default;

/**
 * The single persistence engine for LifeTrack (see docs/decisions/0003-storage-consolidation.md).
 *
 * Every stored byte goes through here: AsyncStorage on device (localStorage on web via
 * AsyncStorage's web implementation). When the native module is missing (Expo Go without the
 * module, unit tests in Node) it degrades to an in-memory map so the app still runs.
 *
 * `StorageService` (documents) and `DatabaseService` (tables) are typed views on top of this.
 */

export const KEY_PREFIX = '@lifetrack:';

class KeyValueStore {
  private cache: Map<string, string> = new Map();
  private available = true;
  private warned = false;

  private markUnavailable(err: unknown) {
    const e = err as { message?: string; name?: string } | undefined;
    const isMissingNative =
      // No backend in this environment at all (e.g. Node tests: the web implementation needs `window`)
      err instanceof ReferenceError ||
      !!e?.message?.includes('Native module is null') ||
      !!e?.message?.includes('NativeModule') ||
      e?.name === 'AsyncStorageError';
    if (isMissingNative) {
      this.available = false;
      if (!this.warned) {
        this.warned = true;
        console.warn('[kvStore] AsyncStorage native module unavailable. Data is kept in memory only.');
      }
    } else {
      console.warn('[kvStore] storage operation failed:', err);
    }
  }

  /** True when writes survive an app restart. */
  isPersistent(): boolean {
    return this.available;
  }

  /** Synchronous read of a value that was already loaded (see `preload`). */
  getSync(key: string): string | null {
    return this.cache.has(key) ? (this.cache.get(key) as string) : null;
  }

  async get(key: string): Promise<string | null> {
    if (this.available) {
      try {
        const value = await AsyncStorage.getItem(key);
        if (value !== null) {
          this.cache.set(key, value);
        } else {
          this.cache.delete(key);
        }
        return value;
      } catch (err) {
        this.markUnavailable(err);
      }
    }
    return this.getSync(key);
  }

  async set(key: string, value: string): Promise<void> {
    this.cache.set(key, value);
    if (!this.available) return;
    try {
      await AsyncStorage.setItem(key, value);
    } catch (err) {
      this.markUnavailable(err);
    }
  }

  async remove(key: string): Promise<void> {
    this.cache.delete(key);
    if (!this.available) return;
    try {
      await AsyncStorage.removeItem(key);
    } catch (err) {
      this.markUnavailable(err);
    }
  }

  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== null;
  }

  /** Every LifeTrack key currently stored. */
  async getAllKeys(): Promise<string[]> {
    const keys = new Set<string>();
    if (this.available) {
      try {
        const all = await AsyncStorage.getAllKeys();
        all.filter((k) => k.startsWith(KEY_PREFIX)).forEach((k) => keys.add(k));
      } catch (err) {
        this.markUnavailable(err);
      }
    }
    this.cache.forEach((_v, k) => {
      if (k.startsWith(KEY_PREFIX)) keys.add(k);
    });
    return Array.from(keys);
  }

  /** Loads keys into the synchronous cache so first render can read them. */
  async preload(keys: string[]): Promise<void> {
    await Promise.all(keys.map((k) => this.get(k)));
  }

  async getJson<T>(key: string, fallback: T): Promise<T> {
    const raw = await this.get(key);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      console.warn(`[kvStore] Corrupt JSON under ${key}; using default.`);
      return fallback;
    }
  }

  getJsonSync<T>(key: string, fallback: T): T {
    const raw = this.getSync(key);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  async setJson(key: string, value: unknown): Promise<void> {
    await this.set(key, JSON.stringify(value));
  }

  /** Removes every LifeTrack key. Used by "delete all my data" and tests. */
  async clearAll(): Promise<void> {
    const keys = await this.getAllKeys();
    for (const k of keys) {
      await this.remove(k);
    }
  }
}

export const kvStore = new KeyValueStore();
