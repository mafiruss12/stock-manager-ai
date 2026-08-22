/**
 * Couche hors-ligne : cache local + file d'attente de sync
 * Les données restent disponibles sans internet.
 * Au retour du réseau, la file est poussée vers Supabase.
 */

const DB_NAME = 'maquis-offline';
const DB_VERSION = 1;
const STORE_CACHE = 'cache';
const STORE_QUEUE = 'queue';

export type QueueAction = 'insert' | 'update' | 'delete';

export interface QueueItem {
  id: string;
  table: string;
  action: QueueAction;
  payload: Record<string, unknown>;
  match?: Record<string, unknown>; // pour update/delete
  createdAt: string;
  retries: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_CACHE)) {
        db.createObjectStore(STORE_CACHE);
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function cacheSet(key: string, data: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CACHE, 'readwrite');
    tx.objectStore(STORE_CACHE).put({ data, savedAt: Date.now() }, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CACHE, 'readonly');
    const req = tx.objectStore(STORE_CACHE).get(key);
    req.onsuccess = () => {
      const row = req.result;
      resolve(row ? (row.data as T) : null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function queueAdd(
  table: string,
  action: QueueAction,
  payload: Record<string, unknown>,
  match?: Record<string, unknown>
): Promise<QueueItem> {
  const item: QueueItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    table,
    action,
    payload,
    match,
    createdAt: new Date().toISOString(),
    retries: 0,
  };
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_QUEUE, 'readwrite');
    tx.objectStore(STORE_QUEUE).put(item);
    tx.oncomplete = () => resolve(item);
    tx.onerror = () => reject(tx.error);
  });
}

export async function queueList(): Promise<QueueItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_QUEUE, 'readonly');
    const req = tx.objectStore(STORE_QUEUE).getAll();
    req.onsuccess = () => resolve((req.result as QueueItem[]) || []);
    req.onerror = () => reject(req.error);
  });
}

export async function queueRemove(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_QUEUE, 'readwrite');
    tx.objectStore(STORE_QUEUE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function queueCount(): Promise<number> {
  const items = await queueList();
  return items.length;
}

/** Indique si le navigateur / appareil est en ligne */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

/** Version async (utilise Capacitor Network sur mobile natif) */
export async function isOnlineAsync(): Promise<boolean> {
  try {
    const { getNativeOnlineStatus, isNative } = await import('./mobile');
    if (isNative) return getNativeOnlineStatus();
  } catch { /* web */ }
  return isOnline();
}

/**
 * Synchronise la file d'attente vers Supabase.
 * Retourne le nombre d'opérations réussies.
 */
export async function flushQueue(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<{ ok: number; fail: number }> {
  if (!isOnline()) return { ok: 0, fail: 0 };
  const items = await queueList();
  let ok = 0;
  let fail = 0;

  for (const item of items) {
    try {
      if (item.action === 'insert') {
        const { error } = await supabase.from(item.table).insert(item.payload);
        if (error) throw error;
      } else if (item.action === 'update') {
        let q = supabase.from(item.table).update(item.payload);
        if (item.match) {
          for (const [k, v] of Object.entries(item.match)) {
            q = q.eq(k, v);
          }
        }
        const { error } = await q;
        if (error) throw error;
      } else if (item.action === 'delete') {
        let q = supabase.from(item.table).delete();
        if (item.match) {
          for (const [k, v] of Object.entries(item.match)) {
            q = q.eq(k, v);
          }
        }
        const { error } = await q;
        if (error) throw error;
      }
      await queueRemove(item.id);
      ok++;
    } catch {
      fail++;
    }
  }
  return { ok, fail };
}

/** Helper : lecture avec fallback cache */
export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: { forceRefresh?: boolean }
): Promise<{ data: T | null; fromCache: boolean }> {
  if (isOnline() && !options?.forceRefresh) {
    try {
      const data = await fetcher();
      await cacheSet(key, data);
      return { data, fromCache: false };
    } catch {
      const cached = await cacheGet<T>(key);
      return { data: cached, fromCache: true };
    }
  }

  if (isOnline() && options?.forceRefresh) {
    try {
      const data = await fetcher();
      await cacheSet(key, data);
      return { data, fromCache: false };
    } catch {
      const cached = await cacheGet<T>(key);
      return { data: cached, fromCache: true };
    }
  }

  // Hors ligne → cache uniquement
  const cached = await cacheGet<T>(key);
  return { data: cached, fromCache: true };
}


/** Profil auth mis en cache pour usage hors ligne */
export async function cacheAuthProfile(profile: {
  userId: string;
  member: unknown;
  establishments?: unknown;
}): Promise<void> {
  await cacheSet(`auth:profile:${profile.userId}`, profile);
  await cacheSet('auth:lastUserId', profile.userId);
}

export async function getCachedAuthProfile(userId?: string): Promise<{
  userId: string;
  member: unknown;
  establishments?: unknown;
} | null> {
  const uid = userId || (await cacheGet<string>('auth:lastUserId'));
  if (!uid) return null;
  return cacheGet(`auth:profile:${uid}`);
}

/** Prefetch tables critiques après login (pour offline) */
export async function prefetchForOffline(
  establishmentId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<void> {
  if (!isOnline() || !establishmentId) return;
  try {
    const tables = ['products', 'expenses', 'sales', 'daily_reports'] as const;
    for (const table of tables) {
      const { data } = await supabase
        .from(table)
        .select('*')
        .eq('establishment_id', establishmentId)
        .limit(500);
      if (data) await cacheSet(`${table}:${establishmentId}`, data);
    }
  } catch {
    /* ignore */
  }
}
