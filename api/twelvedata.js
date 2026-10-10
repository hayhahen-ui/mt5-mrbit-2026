/**
 * /api/twelvedata.js — Proxy TwelveData (forex intraday OHLC thật).
 * POST { apikey, endpoint, params } → https://api.twelvedata.com/<endpoint>?<params>&apikey=...
 * Key chỉ tồn tại trong request, không lưu/không log. Lỗi sanitize [redacted].
 */
const TD_BASE = 'https://api.twelvedata.com';

function sanitize(s) {
  if (!s) return s;
  return String(s).replace(/apikey=[^&\s]*/gi, 'apikey=[redacted]');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Body JSON không hợp lệ.' }); }
  }
  const { apikey, endpoint, params } = body || {};
  if (!apikey || typeof apikey !== 'string' || apikey.length < 8) {
    return res.status(400).json({ error: 'Thiếu API key TwelveData.' });
  }
  const ep = String(endpoint || '').replace(/^\/+/, '');
  if (!/^(time_series|price|quote)$/.test(ep)) {
    return res.status(400).json({ error: 'Endpoint không hỗ trợ.' });
  }

  const qs = new URLSearchParams(params || {});
  qs.set('apikey', apikey);
  const url = `${TD_BASE}/${ep}?${qs.toString()}`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'NexusPilot/1.0' } });
    const text = await r.text();
    let d;
    try { d = JSON.parse(text); } catch { throw new Error('TwelveData không trả về JSON.'); }
    if (d.status === 'error') {
      const msg = sanitize(d.message || 'TwelveData báo lỗi.');
      return res.status(200).json({ error: msg, code: d.code || null });
    }
    return res.status(200).json(d);
  } catch (e) {
    return res.status(200).json({ error: `Lỗi gọi TwelveData: ${sanitize(e.message)}` });
  }
};
