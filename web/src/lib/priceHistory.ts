/**
 * priceHistory.ts — Lịch sử giá có timestamp (localStorage) để tự tính
 * heatmap đa khung (thay cho MyFxBook heat-map bị Cloudflare chặn).
 * - recordPrices: ghi nhận mỗi khi có quote thật (giới hạn 60s/mã).
 * - mtfChange/heatmap: % thay đổi giá so với 5m/15m/1h/4h/24h trước.
 */
const KEY = 'nexuspilot-pricehist-v1';
const MIN_GAP_MS = 60_000;          // tối đa 1 điểm/phút/mã
const KEEP_MS = 30 * 3600_000;      // giữ 30 giờ
const MAX_POINTS = 1500;            // trần an toàn/mã

interface Pt { t: number; p: number }
type Hist = Record<string, Pt[]>;

export const HEATMAP_SYMBOLS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD', 'EURJPY', 'GBPJPY'];
export const HEATMAP_TFS = [5, 15, 60, 240, 1440]; // phút
export const HEATMAP_TF_LABELS: Record<number, string> = { 5: '5m', 15: '15m', 60: '1h', 240: '4h', 1440: '24h' };

function read(): Hist {
  try {
    const raw = localStorage.getItem(KEY);
    const o = raw ? JSON.parse(raw) : {};
    return typeof o === 'object' && o ? o : {};
  } catch { return {}; }
}

function write(h: Hist) {
  try { localStorage.setItem(KEY, JSON.stringify(h)); } catch { /* bỏ qua */ }
}

/** Ghi giá mới — chỉ gọi khi có quote thật (dataSource !== OFFLINE). */
export function recordPrices(prices: Record<string, number>): void {
  if (!prices || Object.keys(prices).length === 0) return;
  const now = Date.now();
  const h = read();
  let changed = false;
  for (const [sym, price] of Object.entries(prices)) {
    if (!Number.isFinite(price) || price <= 0) continue;
    const arr = h[sym] || [];
    const last = arr[arr.length - 1];
    if (last && now - last.t < MIN_GAP_MS) continue; // chưa đủ 60s
    // KHÔNG skip khi giá đứng yên: 0.00% cũng là dữ liệu hợp lệ cho heatmap.
    // (Nguồn daily như ER-API nếu skip giá không đổi thì forex mãi chỉ có 1 điểm.)
    arr.push({ t: now, p: price });
    // Cắt cũ hơn 30h + trần số điểm
    const cutoff = now - KEEP_MS;
    while (arr.length > 0 && arr[0].t < cutoff) arr.shift();
    while (arr.length > MAX_POINTS) arr.shift();
    h[sym] = arr;
    changed = true;
  }
  if (changed) write(h);
}

/** Số điểm giá đã ghi cho từng mã — để kiểm chứng việc thu thập có chạy. */
export function pointCounts(): Record<string, number> {
  const h = read();
  const out: Record<string, number> = {};
  for (const s of HEATMAP_SYMBOLS) out[s] = h[s]?.length ?? 0;
  return out;
}

/** % thay đổi so với N phút trước — null khi thiếu dữ liệu (tolerance 50% khung). */
export function mtfChange(symbol: string, minutes: number): number | null {
  const arr = read()[symbol];
  if (!arr || arr.length < 2) return null;
  const now = Date.now();
  const target = now - minutes * 60_000;
  const tol = minutes * 60_000 * 0.5;
  // Điểm GẦN mốc target nhất (không phải điểm mới nhất trong cửa sổ)
  let ref: Pt | null = null;
  let bestDiff = Infinity;
  for (const pt of arr) {
    const d = Math.abs(pt.t - target);
    if (d < bestDiff) { bestDiff = d; ref = pt; }
  }
  if (!ref || bestDiff > tol) return null;
  const cur = arr[arr.length - 1];
  // Điểm hiện tại phải mới (trong 1/2 khung) — tránh so với giá cũ rích
  if (now - cur.t > tol) return null;
  if (ref.p <= 0) return null;
  return Number((((cur.p - ref.p) / ref.p) * 100).toFixed(2));
}

/** Heatmap đầy đủ: { SYM: { 5: %, 15: %, 60: %, 240: %, 1440: % } } */
export function heatmap(symbols: string[] = HEATMAP_SYMBOLS): Record<string, Record<number, number | null>> {
  const out: Record<string, Record<number, number | null>> = {};
  for (const s of symbols) {
    out[s] = {};
    for (const tf of HEATMAP_TFS) out[s][tf] = mtfChange(s, tf);
  }
  return out;
}

/** Giá mới nhất từng mã (điểm cuối của mỗi chuỗi). */
export function latestPrices(): Record<string, number> {
  const h = read();
  const out: Record<string, number> = {};
  for (const [sym, arr] of Object.entries(h)) {
    if (arr.length) out[sym] = arr[arr.length - 1].p;
  }
  return out;
}

/** Dòng tóm tắt cho prompt AI: "EURUSD: 5m +0.02%, 15m -0.05%..." */
export function heatmapSummary(symbols: string[] = HEATMAP_SYMBOLS): string {
  const hm = heatmap(symbols);
  return symbols.map((s) => {
    const parts = HEATMAP_TFS.map((tf) => {
      const v = hm[s][tf];
      return `${HEATMAP_TF_LABELS[tf]} ${v === null ? '—' : `${v >= 0 ? '+' : ''}${v}%`}`;
    });
    return `${s}: ${parts.join(', ')}`;
  }).join('\n');
}
