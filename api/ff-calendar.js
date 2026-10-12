/**
 * /api/ff-calendar — Proxy nội bộ lấy lịch kinh tế ForexFactory.
 * faireconomy.media không gửi header CORS nên trình duyệt chặn fetch trực tiếp;
 * function chạy phía server nên không bị CORS, trả về kèm Access-Control-Allow-Origin: *.
 *
 * Cải tiến 12/10: retry 2 lần, header trình duyệt thật, timeout 10s/lần,
 * message lỗi chi tiết để client không gán nhầm thành "empty".
 */
const UPSTREAM = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';

async function fetchOnce() {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch(UPSTREAM, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'application/json',
      },
    });
    if (!r.ok) throw new Error(`upstream HTTP ${r.status}`);
    const data = await r.json();
    if (!Array.isArray(data)) throw new Error('upstream không trả mảng');
    if (data.length === 0) throw new Error('upstream trả mảng rỗng');
    return data;
  } finally {
    clearTimeout(t);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
  let lastErr = 'unknown';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const data = await fetchOnce();
      return res.status(200).json(data);
    } catch (e) {
      lastErr = String((e && e.message) || e);
      // Chờ 1s trước khi retry (trừ lần cuối)
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1000));
    }
  }
  res.status(502).json({ error: 'proxy_failed', message: `Thử 3 lần đều lỗi: ${lastErr}` });
}
