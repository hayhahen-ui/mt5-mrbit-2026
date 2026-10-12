/**
 * /api/gold-flows.js — Proxy dòng vốn vàng (WGC ETF flows + GLD proxy).
 *
 * Kiến trúc theo pattern FRED:
 * - Đọc từ KHO ONLINE (nhánh data GitHub): research/gold-flows/latest.json
 * - Kho được cập nhật bởi GitHub Action hàng tháng (số liệu WGC chính thức)
 *   + GLD daily từ TwelveData (app tự đẩy khi có dữ liệu tươi)
 *
 * Nguồn:
 * - WGC (gold.org): hàng tháng, tổng holdings + flows theo khu vực — KHÔNG có public API
 * - GLD (SPDR): proxy hàng ngày qua giá/volume — đã có TwelveData trong app
 */
const REPO = 'hayhahen-ui/mt5-mrbit-2026';
const BRANCH = 'data';
const CACHE_PATH = 'research/gold-flows/latest.json';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  try {
    const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${CACHE_PATH}?t=${Date.now()}`;
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`kho online HTTP ${r.status}`);
    const d = await r.json();
    if (!d || !d.updatedAt) throw new Error('kho trống');
    return res.status(200).json(d);
  } catch (e) {
    return res.status(502).json({
      error: 'gold_flows_unavailable',
      message: `Chưa có dữ liệu dòng vốn vàng: ${String((e && e.message) || e)}`,
    });
  }
}
