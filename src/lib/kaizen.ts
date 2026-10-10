import { KaizenRecord, KaizenAnalysis, JournalOutcome } from '../types';

const KEY = 'nexuspilot-kaizen-v1';
const MAX_RECORDS = 2000;

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

function saveKaizen(records: KaizenRecord[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(records.slice(-MAX_RECORDS)));
  } catch {
    /* kho đầy — giữ nguyên dữ liệu cũ, không tự xóa */
  }
}

export function clearKaizen(): void {
  try {
    localStorage.removeItem(KEY);
  } catch { /* noop */ }
}

/**
 * Ghi nhật ký Kaizen. Chống trùng: cùng symbol+direction+verdict trong
 * dedupMinutes phút thì bỏ qua để nhật ký gọn.
 */
export function appendKaizen(rec: KaizenRecord, dedupMinutes = 15): KaizenRecord | null {
  const all = loadKaizen();
  const cutoff = Date.now() - dedupMinutes * 60000;
  const dup = all.some(
    (r) =>
      r.ts > cutoff &&
      r.symbol === rec.symbol &&
      r.direction === rec.direction &&
      r.verdict === rec.verdict
  );
  if (dup) return null;
  all.push(rec);
  saveKaizen(all);
  return rec;
}

/** Liên kết kết quả lệnh đã đóng vào bản ghi Kaizen tương ứng */
export function linkKaizenOutcome(kaizenId: string, outcome: JournalOutcome, rMultiple: number): void {
  const all = loadKaizen();
  const rec = all.find((r) => r.id === kaizenId);
  if (!rec) return;
  rec.outcome = outcome;
  rec.rMultiple = rMultiple;
  saveKaizen(all);
}

/** Tìm bản ghi Kaizen gần nhất khớp với tín hiệu vừa thực thi */
export function findLatestKaizenFor(symbol: string, direction: string): KaizenRecord | undefined {
  const all = loadKaizen();
  for (let i = all.length - 1; i >= 0; i--) {
    const r = all[i];
    if (r.symbol === symbol && r.direction === direction && !r.outcome) return r;
  }
  return undefined;
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

export function analyzeKaizen(): KaizenAnalysis {
  return analyze(loadKaizen());
}
