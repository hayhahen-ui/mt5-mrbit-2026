/**
 * /api/ff-calendar — Proxy nội bộ lấy lịch kinh tế ForexFactory.
 * faireconomy.media không gửi header CORS nên trình duyệt chặn fetch trực tiếp;
 * function chạy phía server nên không bị CORS, trả về kèm Access-Control-Allow-Origin: *.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const r = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'NexusPilot/1.0' },
    });
    clearTimeout(t);
    if (!r.ok) throw new Error(`upstream HTTP ${r.status}`);
    const data = await r.json();
    if (!Array.isArray(data)) throw new Error('upstream not array');
    res.status(200).json(data);
  } catch (e) {
    res.status(502).json({ error: 'proxy_failed', message: String((e && e.message) || e) });
  }
}
