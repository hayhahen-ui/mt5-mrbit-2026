/**
 * research/fred.ts — Client FRED qua proxy nội bộ /api/fred.
 * Chuỗi Blueprint §4.4: DGS2, DGS10 (lợi suất danh nghĩa), DFII10 (lợi suất thực),
 * DTWEXBGS (USD rổ rộng), T10YIE (breakeven lạm phát).
 * Key free tại fred.stlouisfed.org → lưu localStorage (như TwelveData).
 */
import { readApiJson } from '../apiHealth';

export type FredSeriesId = 'DGS2' | 'DGS10' | 'DFII10' | 'DTWEXBGS' | 'T10YIE';

export const FRED_SERIES_META: Record<FredSeriesId, { label: string; unit: string; desc: string }> = {
  DGS2: { label: 'Lợi suất US 2Y', unit: '%', desc: 'Treasury 2 năm — proxy điều kiện lãi suất Mỹ' },
  DGS10: { label: 'Lợi suất US 10Y', unit: '%', desc: 'Treasury 10 năm — bối cảnh dài hạn' },
  DFII10: { label: 'Lợi suất thực 10Y', unit: '%', desc: 'TIPS 10Y — chi phí cơ hội của vàng' },
  DTWEXBGS: { label: 'USD Broad Index', unit: 'điểm', desc: 'Chỉ số USD rổ rộng (khác DXY)' },
  T10YIE: { label: 'Breakeven lạm phát 10Y', unit: '%', desc: 'Kỳ vọng lạm phát thị trường' },
};

const KEY_LS = 'nexuspilot-fred-key';
export const getFredKey = (): string => { try { return localStorage.getItem(KEY_LS) || ''; } catch { return ''; } };
export const setFredKey = (k: string): void => { try { localStorage.setItem(KEY_LS, k.trim()); } catch { /* noop */ } };

export interface FredPoint { date: string; value: number | null }
export interface FredSeries {
  id: FredSeriesId;
  latest: FredPoint | null;
  previous: FredPoint | null;
  change: number | null;       // latest - previous
  changePct: number | null;
  points: FredPoint[];         // mới → cũ
  fetchedAt: number;
  error?: string;
}

const CACHE = new Map<FredSeriesId, FredSeries>();
const CACHE_TTL = 6 * 3600 * 1000; // FRED là dữ liệu ngày — cache 6h

export async function fetchFredSeries(id: FredSeriesId, limit = 12): Promise<FredSeries> {
  const cached = CACHE.get(id);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL && !cached.error) return cached;

  const key = getFredKey();
  const fail = (error: string): FredSeries => {
    const s: FredSeries = { id, latest: null, previous: null, change: null, changePct: null, points: [], fetchedAt: Date.now(), error };
    CACHE.set(id, s);
    return s;
  };
  if (!key) return fail('Chưa nhập FRED API key (miễn phí tại fred.stlouisfed.org).');

  try {
    const r = await fetch('/api/fred', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apikey: key, series_id: id, limit }),
    });
    const d = await readApiJson(r, 'FRED');
    if (d.error) return fail(String(d.error));
    const obs = (d.observations || []) as Array<{ date: string; value: string }>;
    const points: FredPoint[] = obs
      .map((o) => ({ date: o.date, value: o.value === '.' ? null : Number(o.value) }))
      .filter((p) => p.value !== null && isFinite(p.value!));
    if (points.length === 0) return fail('FRED không trả quan sát hợp lệ.');
    const latest = points[0];
    const previous = points[1] || null;
    const change = previous ? latest.value! - previous.value! : null;
    const s: FredSeries = {
      id, latest, previous, change,
      changePct: change !== null && previous?.value ? (change / Math.abs(previous.value)) * 100 : null,
      points, fetchedAt: Date.now(),
    };
    CACHE.set(id, s);
    return s;
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

export async function fetchAllFred(): Promise<Record<FredSeriesId, FredSeries>> {
  const ids: FredSeriesId[] = ['DGS2', 'DGS10', 'DFII10', 'DTWEXBGS', 'T10YIE'];
  const out = {} as Record<FredSeriesId, FredSeries>;
  for (const id of ids) {
    out[id] = await fetchFredSeries(id);
    await new Promise((r) => setTimeout(r, 300)); // giãn request
  }
  return out;
}

export function clearFredCache(): void { CACHE.clear(); }
