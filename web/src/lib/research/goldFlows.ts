/**
 * research/goldFlows.ts — Dòng vốn vàng: WGC (tháng) + GLD proxy (ngày).
 *
 * Tầng dữ liệu:
 * 1. WGC chính thức (gold.org) — hàng tháng, KHÔNG có public API → kho online qua Action
 * 2. GLD (SPDR Gold Shares) — proxy hàng ngày qua TwelveData (giá + volume)
 *    Logic: volume > 1.5x trung bình 20 ngày + giá tăng = dòng tiền vào ETF
 * 3. Input tay — fallback khi cả 2 trên đều thiếu
 */
import { readApiJson } from '../apiHealth';

export interface GoldFlowData {
  // WGC chính thức (tháng)
  wgc: {
    month: string; // YYYY-MM
    flowTons: number | null; // tấn, dương = vào
    totalTons: number | null;
    source: string;
    updatedAt: string;
  } | null;
  // GLD proxy (ngày)
  gld: {
    date: string;
    close: number;
    volume: number;
    avgVolume20: number | null;
    volumeRatio: number | null; // volume / avg20
    weekChangePct: number | null;
    signal: -2 | -1 | 0 | 1 | 2 | null; // tín hiệu dòng vốn
  } | null;
}

const LS_KEY = 'nexuspilot-gold-flows-cache';

/** Đọc từ kho online qua proxy. */
export async function fetchGoldFlows(): Promise<GoldFlowData | null> {
  try {
    const cached = localStorage.getItem(LS_KEY);
    if (cached) {
      const d = JSON.parse(cached);
      if (Date.now() - d.cachedAt < 6 * 3600000) return d.data;
    }
  } catch { /* noop */ }
  try {
    const r = await fetch(`/api/gold-flows?t=${Date.now()}`, { cache: 'no-store' });
    const d = await readApiJson(r, 'Dòng vốn vàng');
    if (d.error) return null;
    const data: GoldFlowData = { wgc: d.wgc || null, gld: d.gld || null };
    try { localStorage.setItem(LS_KEY, JSON.stringify({ data, cachedAt: Date.now() })); } catch { /* noop */ }
    return data;
  } catch {
    return null;
  }
}

/** Lấy GLD daily qua TwelveData proxy (cần key đã lưu). */
export async function fetchGldDaily(tdKey: string): Promise<GoldFlowData['gld']> {
  const r = await fetch('/api/twelvedata', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: tdKey, endpoint: 'time_series', params: { symbol: 'GLD', interval: '1day', outputsize: '25' } }),
  });
  const d = await readApiJson(r, 'TwelveData GLD');
  if (d.error || d.status === 'error' || !Array.isArray(d.values) || d.values.length < 5) return null;
  const vals = d.values; // mới nhất trước
  const latest = vals[0];
  const close = parseFloat(latest.close);
  const volume = parseFloat(latest.volume || '0');
  // Trung bình volume 20 ngày (bỏ ngày mới nhất)
  const vols = vals.slice(1, 21).map((v: any) => parseFloat(v.volume || '0')).filter((v: number) => v > 0);
  const avgVol = vols.length >= 10 ? vols.reduce((a: number, b: number) => a + b, 0) / vols.length : null;
  const volumeRatio = avgVol && volume > 0 ? volume / avgVol : null;
  // Biến động tuần (5 ngày)
  const weekAgo = vals[4] ? parseFloat(vals[4].close) : null;
  const weekChangePct = weekAgo ? ((close - weekAgo) / weekAgo) * 100 : null;

  // Tín hiệu: volume bất thường + hướng giá
  let signal: GoldFlowData['gld'] extends infer T ? T extends { signal: infer S } ? S : null : null = null;
  if (volumeRatio !== null && weekChangePct !== null) {
    if (volumeRatio >= 1.5 && weekChangePct >= 1) signal = 2;       // volume lớn + tăng mạnh = vào mạnh
    else if (volumeRatio >= 1.2 && weekChangePct > 0) signal = 1;   // vào nhẹ
    else if (volumeRatio >= 1.5 && weekChangePct <= -1) signal = -2; // volume lớn + giảm mạnh = ra mạnh
    else if (volumeRatio >= 1.2 && weekChangePct < 0) signal = -1;  // ra nhẹ
    else signal = 0; // bình thường
  }
  return {
    date: latest.datetime?.slice(0, 10) || '',
    close, volume, avgVolume20: avgVol, volumeRatio, weekChangePct, signal,
  };
}
