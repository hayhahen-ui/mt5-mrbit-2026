/**
 * idb.ts — Kho IndexedDB cho dữ liệu lớn (dung lượng hàng GB, thay vì 5MB của localStorage).
 * Dùng cho nhật ký Kaizen + Neural (append nhiều, bản ghi nặng).
 * localStorage giữ cache nóng (đồng bộ) cho phân tích realtime; IDB giữ toàn bộ lịch sử.
 * Luật dữ liệu: IDB append-only — không tự xóa; chỉ user bấm tay mới xóa.
 */

const DB_NAME = 'nexuspilot-v1';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Trình duyệt không hỗ trợ IndexedDB.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // keyPath 'id': dùng id sẵn có của bản ghi (KZ-.../NN-...) để put() upsert được
      if (!db.objectStoreNames.contains('kaizen')) {
        db.createObjectStore('kaizen', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('neural')) {
        db.createObjectStore('neural', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Không mở được IndexedDB.'));
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  if (!dbPromise) dbPromise = openDb();
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const t = d.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('IDB lỗi.'));
      })
  );
}

/** Thêm 1 bản ghi (append-only). */
export function idbAdd(store: 'kaizen' | 'neural', record: any): Promise<IDBValidKey> {
  return tx(store, 'readwrite', (s) => s.add(record));
}

/** Upsert theo id (dùng khi gắn outcome vào bản ghi cũ). */
export function idbPut(store: 'kaizen' | 'neural', record: any): Promise<IDBValidKey> {
  return tx(store, 'readwrite', (s) => s.put(record));
}

/** Đọc toàn bộ (dùng cho phân tích sâu). */
export function idbGetAll<T = any>(store: 'kaizen' | 'neural'): Promise<T[]> {
  return tx(store, 'readonly', (s) => s.getAll());
}

/** Đếm số bản ghi. */
export function idbCount(store: 'kaizen' | 'neural'): Promise<number> {
  return tx(store, 'readonly', (s) => s.count());
}

/** Xóa toàn bộ store — CHỈ gọi khi user bấm tay. */
export function idbClear(store: 'kaizen' | 'neural'): Promise<void> {
  return tx(store, 'readwrite', (s) => s.clear()).then(() => undefined);
}

/**
 * Ước tính dung lượng 1 store (byte) bằng cách đo mẫu 20 bản ghi đầu.
 * IndexedDB không cho đọc size trực tiếp nên dùng ước tính.
 */
export async function idbSizeEstimate(store: 'kaizen' | 'neural'): Promise<{ count: number; bytes: number }> {
  const count = await idbCount(store).catch(() => 0);
  if (count === 0) return { count: 0, bytes: 0 };
  try {
    const sample: any[] = await tx(store, 'readonly', (s) => s.getAll(null as any, 20));
    const sampleBytes = sample.reduce((a, r) => a + JSON.stringify(r).length * 2, 0);
    const avg = sample.length ? sampleBytes / sample.length : 0;
    return { count, bytes: Math.round(avg * count) };
  } catch {
    return { count, bytes: 0 };
  }
}

/** Dung lượng ước tính trình duyệt cấp cho origin này (navigator.storage). */
export async function storageQuota(): Promise<{ quota: number; usage: number } | null> {
  try {
    if (!navigator.storage?.estimate) return null;
    const e = await navigator.storage.estimate();
    return { quota: e.quota || 0, usage: e.usage || 0 };
  } catch {
    return null;
  }
}
