import { NeuralRecord } from './contracts';

/**
 * neural/repository.ts — Lưu trữ snapshot + assessment (localStorage).
 * - Dedup theo dedupKey: sự kiện gửi lại không tạo bản ghi trùng.
 * - Snapshot bất biến: deep-copy khi ghi.
 * - Không tự xóa dữ liệu người dùng (tuân thủ quy tắc kho đầy).
 */

const KEY = 'nexuspilot-neural-v1';
const MAX_RECORDS = 1000;

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

function saveAll(records: NeuralRecord[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(records.slice(-MAX_RECORDS)));
  } catch {
    /* kho đầy — giữ nguyên dữ liệu cũ, không tự xóa */
  }
}

export function clearNeuralRecords(): void {
  try {
    localStorage.removeItem(KEY);
  } catch { /* noop */ }
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
  saveAll(all);
  return true;
}

/** Truy vấn có giới hạn mới nhất trước */
export function queryNeuralRecords(limit = 50): NeuralRecord[] {
  return loadNeuralRecords().slice(-limit).reverse();
}

export function countNeuralRecords(): number {
  return loadNeuralRecords().length;
}
