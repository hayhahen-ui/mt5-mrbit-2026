import { KaizenRecord, KaizenAnalysis, JournalOutcome } from '../types';
import { idbAdd, idbPut, idbGetAll, idbClear, idbSizeEstimate } from './idb';

/**
 * Kaizen — 2 tầng lưu trữ:
 * - NÓNG (localStorage, đồng bộ): 300 bản gần nhất → phân tích realtime, tìm/link nhanh.
 * - LẠNH (IndexedDB, hàng GB): toàn bộ lịch sử, append-only, không tự xóa.
 * Di trú 1 lần: bản ghi cũ vượt quá 300 được chuyển xuống IDB (không mất dữ liệu).
 */
const KEY = 'nexuspilot-kaizen-v1';
const HOT = 300;
const MIGRATED_KEY = 'nexuspilot-kaizen-migrated-v1';

/** Cache nóng — đọc đồng bộ cho realtime. */
export function loadKaizen(): KaizenRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveHot(records: KaizenRecord[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(records.slice(-HOT)));
  } catch {
    /* kho đầy — giữ nguyên dữ liệu cũ, không tự xóa */
  }
}

/** Đọc TOÀN BỘ (IDB + nóng, khử trùng theo id) — dùng cho phân tích sâu. */
export async function loadKaizenAll(): Promise<KaizenRecord[]> {
  const hot = loadKaizen();
  let cold: KaizenRecord[] = [];
  try {
    cold = await idbGetAll<KaizenRecord>('kaizen');
  } catch { /* IDB chưa sẵn sàng → chỉ dùng nóng */ }
  const seen = new Set(hot.map((r) => r.id));
  const merged = [...cold.filter((r) => r && !seen.has(r.id)), ...hot];
  merged.sort((a, b) => a.ts - b.ts);
  return merged;
}

/** Di trú 1 lần: chuyển bản ghi cũ (ngoài 300 nóng) xuống IndexedDB. */
export async function migrateKaizenToIdb(): Promise<number> {
  try {
    if (localStorage.getItem(MIGRATED_KEY) === '1') return 0;
  } catch { /* noop */ }
  const all = loadKaizen();
  if (all.length <= HOT) {
    try { localStorage.setItem(MIGRATED_KEY, '1'); } catch { /* noop */ }
    return 0;
  }
  const cold = all.slice(0, all.length - HOT);
  // Chỉ cắt bản nào đã chuyển thành công — IDB hỏng thì GIỮ NGUYÊN localStorage
  const movedIds = new Set<string>();
  for (const r of cold) {
    try {
      await idbAdd('kaizen', r);
      movedIds.add(r.id);
    } catch {
      try { await idbPut('kaizen', r); movedIds.add(r.id); } catch { /* giữ lại local */ }
    }
  }
  if (movedIds.size === 0) return 0; // IDB không dùng được → không cắt gì cả
  const remaining = all.filter((r) => !movedIds.has(r.id));
  saveHot(remaining);
  try { localStorage.setItem(MIGRATED_KEY, '1'); } catch { /* noop */ }
  return movedIds.size;
}

export function clearKaizen(): void {
  try {
    localStorage.removeItem(KEY);
  } catch { /* noop */ }
  idbClear('kaizen').catch(() => { /* noop */ });
}

/**
 * Ghi nhật ký Kaizen. Chống trùng: cùng symbol+direction+verdict trong
 * dedupMinutes phút thì bỏ qua để nhật ký gọn.
 */
export function appendKaizen(rec: KaizenRecord, dedupMinutes = 15): KaizenRecord | null {
  const hot = loadKaizen();
  const cutoff = Date.now() - dedupMinutes * 60000;
  const dup = hot.some(
    (r) =>
      r.ts > cutoff &&
      r.symbol === rec.symbol &&
      r.direction === rec.direction &&
      r.verdict === rec.verdict
  );
  if (dup) return null;
  hot.push(rec);
  saveHot(hot);
  // Ghi lạnh (không chặn luồng chính)
  idbAdd('kaizen', rec).catch(() => idbPut('kaizen', rec).catch(() => { /* noop */ }));
  return rec;
}

/** Liên kết kết quả lệnh đã đóng vào bản ghi Kaizen tương ứng (nóng + lạnh). */
export function linkKaizenOutcome(kaizenId: string, outcome: JournalOutcome, rMultiple: number): void {
  const hot = loadKaizen();
  const rec = hot.find((r) => r.id === kaizenId);
  if (rec) {
    rec.outcome = outcome;
    rec.rMultiple = rMultiple;
    saveHot(hot);
    idbPut('kaizen', rec).catch(() => { /* noop */ });
  } else {
    // Bản ghi đã chìm xuống lạnh → cập nhật trực tiếp trong IDB
    idbGetAll<KaizenRecord>('kaizen')
      .then((all) => {
        const c = all.find((r) => r.id === kaizenId);
        if (c) {
          c.outcome = outcome;
          c.rMultiple = rMultiple;
          return idbPut('kaizen', c);
        }
      })
      .catch(() => { /* noop */ });
  }
}

/** Tìm bản ghi Kaizen gần nhất khớp với tín hiệu vừa thực thi (trong cache nóng). */
export function findLatestKaizenFor(symbol: string, direction: string): KaizenRecord | undefined {
  const hot = loadKaizen();
  for (let i = hot.length - 1; i >= 0; i--) {
    const r = hot[i];
    if (r.symbol === symbol && r.direction === direction && !r.outcome) return r;
  }
  return undefined;
}

/** Thống kê kho cho đồng hồ bộ nhớ. */
export async function kaizenStoreStats(): Promise<{ hot: number; cold: number; coldBytes: number }> {
  const est = await idbSizeEstimate('kaizen').catch(() => ({ count: 0, bytes: 0 }));
  return { hot: loadKaizen().length, cold: est.count, coldBytes: est.bytes };
}

/* ---------- phân tích Kaizen ---------- */

interface Bucket { evaluated: number; closed: number; wins: number; sumR: number; }

function analyze(records: KaizenRecord[]): KaizenAnalysis {
  const byEngine = new Map<string, Bucket & { name: string }>();
  const byVerdict = new Map<string, Bucket>();
  const bySession = new Map<string, Bucket>();
  const fMap = new Map<string, { label: string; evaluated: number; passed: number; closedPass: number; winsPass: number; sumRPass: number }>();

  const bucket = () => ({ evaluated: 0, closed: 0, wins: 0, sumR: 0 });

  for (const r of records) {
    const closed = r.outcome !== undefined;
    const win = r.outcome === 'TP';
    const rM = r.rMultiple ?? 0;

    const eb = byEngine.get(r.engine) || { ...bucket(), name: r.engineName };
    eb.evaluated++; if (closed) { eb.closed++; eb.sumR += rM; if (win) eb.wins++; }
    byEngine.set(r.engine, eb);

    const vb = byVerdict.get(r.verdict) || bucket();
    vb.evaluated++; if (closed) { vb.closed++; vb.sumR += rM; if (win) vb.wins++; }
    byVerdict.set(r.verdict, vb);

    const sessKey = r.snapshot.session.split('+')[0];
    const sb = bySession.get(sessKey) || bucket();
    sb.evaluated++; if (closed) { sb.closed++; sb.sumR += rM; if (win) sb.wins++; }
    bySession.set(sessKey, sb);

    for (const f of r.factors) {
      const fe = fMap.get(f.id) || { label: f.label, evaluated: 0, passed: 0, closedPass: 0, winsPass: 0, sumRPass: 0 };
      fe.evaluated++;
      if (f.passed) {
        fe.passed++;
        if (closed) {
          fe.closedPass++;
          fe.sumRPass += rM;
          if (win) fe.winsPass++;
        }
      }
      fMap.set(f.id, fe);
    }
  }

  const pct = (a: number, b: number) => (b > 0 ? Number(((a / b) * 100).toFixed(1)) : 0);
  const avg = (s: number, b: number) => (b > 0 ? Number((s / b).toFixed(2)) : 0);

  return {
    totalEvaluated: records.length,
    totalClosed: records.filter((r) => r.outcome !== undefined).length,
    byEngine: [...byEngine.entries()].map(([engine, b]) => ({
      engine, evaluated: b.evaluated, closed: b.closed,
      winRate: pct(b.wins, b.closed), avgR: avg(b.sumR, b.closed),
    })),
    byVerdict: [...byVerdict.entries()].map(([verdict, b]) => ({
      verdict: verdict as any, evaluated: b.evaluated, closed: b.closed,
      winRate: pct(b.wins, b.closed), avgR: avg(b.sumR, b.closed),
    })),
    bySession: [...bySession.entries()].map(([session, b]) => ({
      session, evaluated: b.evaluated, closed: b.closed,
      winRate: pct(b.wins, b.closed), avgR: avg(b.sumR, b.closed),
    })),
    factors: [...fMap.entries()].map(([factorId, f]) => ({
      factorId,
      label: f.label,
      evaluated: f.evaluated,
      passed: f.passed,
      closedWithPass: f.closedPass,
      winRateWhenPassed: pct(f.winsPass, f.closedPass),
      avgRWhenPassed: avg(f.sumRPass, f.closedPass),
    })).sort((a, b) => b.winRateWhenPassed - a.winRateWhenPassed),
  };
}

/** Phân tích trên cache nóng (đồng bộ, realtime). */
export function analyzeKaizen(): KaizenAnalysis {
  return analyze(loadKaizen());
}

/** Phân tích trên TOÀN BỘ lịch sử (nóng + lạnh). */
export async function analyzeKaizenFull(): Promise<KaizenAnalysis> {
  return analyze(await loadKaizenAll());
}
