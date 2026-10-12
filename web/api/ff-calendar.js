/**
 * /api/ff-calendar — Lịch kinh tế ForexFactory.
 *
 * Vấn đề 12/10: faireconomy.media rate-limit (429) IP Vercel → proxy trực tiếp không ổn định.
 * Giải pháp: đọc từ KHO ONLINE (nhánh data GitHub, cập nhật bởi Action hàng tuần),
 * chỉ gọi upstream khi kho trống/quá cũ.
 */
const REPO = 'hayhahen-ui/mt5-mrbit-2026';
const BRANCH = 'data';
const CACHE_PATH = 'research/ff-calendar/latest.json';
const UPSTREAM = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';

async function fetchUpstream() {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(UPSTREAM, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
        'Accept': 'application/json',
      },
    });
    if (!r.ok) throw new Error(`upstream HTTP ${r.status}`);
    const data = await r.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error('upstream dữ liệu lạ');
    return data;
  } finally {
    clearTimeout(t);
  }
}

async function fetchCache() {
  const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${CACHE_PATH}?t=${Date.now()}`;
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`cache HTTP ${r.status}`);
  const d = await r.json();
  if (!d || !Array.isArray(d.events) || d.events.length === 0) throw new Error('cache trống');
  return d;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
  // 1) Ưu tiên kho online (không bị rate-limit)
  try {
    const cached = await fetchCache();
    const ageH = (Date.now() - new Date(cached.fetchedAt).getTime()) / 3600000;
    // Kho dưới 7 ngày là dùng được (lịch theo tuần)
    if (ageH < 7 * 24) {
      res.setHeader('X-FF-Source', `github-cache age=${Math.round(ageH)}h`);
      return res.status(200).json(cached.events);
    }
  } catch (e) {
    // Kho lỗi → thử upstream
  }
  // 2) Fallback: gọi trực tiếp (có thể 429)
  try {
    const data = await fetchUpstream();
    res.setHeader('X-FF-Source', 'upstream-live');
    return res.status(200).json(data);
  } catch (e) {
    return res.status(502).json({
      error: 'proxy_failed',
      message: `Kho cache lỗi và upstream cũng lỗi: ${String((e && e.message) || e)}`,
    });
  }
}
