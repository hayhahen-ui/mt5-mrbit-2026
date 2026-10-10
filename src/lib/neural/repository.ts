import { NeuralRecord } from './contracts';
import { idbAdd, idbPut, idbGetAll, idbClear, idbSizeEstimate } from '../idb';

/**
 * neural/repository.ts — 2 tầng lưu trữ (như Kaizen):
 * - NÓNG (localStorage, đồng bộ): 200 bản gần nhất.
 * - LẠNH (IndexedDB): toàn bộ lịch sử, append-only, không tự xóa.
 * - Dedup theo dedupKey: sự kiện gửi lại không tạo bản ghi trùng.
 * - Snapshot bất biến: deep-copy khi ghi.
 */

const KEY = 'nexuspilot-neural-v1';
const HOT = 200;
const MIGRATED_KEY = 'nexuspilot-neural-migrated-v1';

type StoredRecord = NeuralRecord & { id: string };
const toStored = (rec: NeuralRecord): StoredRecord =>
  ({ ...JSON.parse(JSON.stringify(rec)), id: rec.snapshot.setupId } as StoredRecord);

export function loadNeuralRecords(): NeuralRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveHot(records: NeuralRecord[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(records.slice(-HOT)));
  } catch {
    /* kho đầy — giữ nguyên dữ liệu cũ, không tự xóa */
  }
}

/** Đọc TOÀN BỘ (IDB + nóng, khử trùng theo setupId). */
export async function loadNeuralRecordsAll(): Promise<NeuralRecord[]> {
  const hot = loadNeuralRecords();
  let cold: NeuralRecord[] = [];
  try {
    cold = await idbGetAll<NeuralRecord>('neural');
  } catch { /* IDB chưa sẵn sàng */ }
  const seen = new Set(hot.map((r) => r.snapshot.setupId));
  return [...cold.filter((r) => r && !seen.has(r.snapshot.setupId)), ...hot];
}

/** Di trú 1 lần: chuyển bản ghi cũ xuống IndexedDB. */
export async function migrateNeuralToIdb(): Promise<number> {
  try {
    if (localStorage.getItem(MIGRATED_KEY) === '1') return 0;
  } catch { /* noop */ }
  const all = loadNeuralRecords();
  if (all.length <= HOT) {
    try { localStorage.setItem(MIGRATED_KEY, '1'); } catch { /* noop */ }
    return 0;
  }
  const cold = all.slice(0, all.length - HOT);
  const movedIds = new Set<string>();
  for (const r of cold) {
    try {
      await idbAdd('neural', toStored(r));
      movedIds.add(r.snapshot.setupId);
    } catch {
      try { await idbPut('neural', toStored(r)); movedIds.add(r.snapshot.setupId); } catch { /* giữ lại local */ }
    }
  }
  if (movedIds.size === 0) return 0; // IDB không dùng được → không cắt gì cả
  const remaining = all.filter((r) => !movedIds.has(r.snapshot.setupId));
  saveHot(remaining);
  try { localStorage.setItem(MIGRATED_KEY, '1'); } catch { /* noop */ }
  return movedIds.size;
}

export function clearNeuralRecords(): void {
  try {
    localStorage.removeItem(KEY);
  } catch { /* noop */ }
  idbClear('neural').catch(() => { /* noop */ });
}

/**
 * Ghi bản ghi; trả về false nếu dedupKey đã tồn tại (T07).
 * Deep-copy snapshot để đảm bảo bất biến (T04).
 */
export function saveNeuralRecord(rec: NeuralRecord): boolean {
  const all = loadNeuralRecords();
  if (all.some((r) => r.snapshot.dedupKey === rec.snapshot.dedupKey)) return false;
  const frozen: NeuralRecord = JSON.parse(JSON.stringify(rec));
  all.push(frozen);
  saveHot(all);
  idbAdd('neural', toStored(frozen)).catch(() => idbPut('neural', toStored(frozen)).catch(() => { /* noop */ }));
  return true;
}

/** Truy vấn có giới hạn mới nhất trước (cache nóng). */
export function queryNeuralRecords(limit = 50): NeuralRecord[] {
  return loadNeuralRecords().slice(-limit).reverse();
}

export function countNeuralRecords(): number {
  return loadNeuralRecords().length;
}

/** Thống kê kho cho đồng hồ bộ nhớ. */
export async function neuralStoreStats(): Promise<{ hot: number; cold: number; coldBytes: number }> {
  const est = await idbSizeEstimate('neural').catch(() => ({ count: 0, bytes: 0 }));
  return { hot: loadNeuralRecords().length, cold: est.count, coldBytes: est.bytes };
}
