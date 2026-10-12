/**
 * /api/fred.js — Proxy FRED (Federal Reserve Economic Data).
 * POST { apikey, series_id, limit } → https://api.stlouisfed.org/fred/series/observations
 * Key chỉ tồn tại trong request, không lưu/không log. Lỗi sanitize [redacted].
 * Chuỗi hỗ trợ: DGS2, DGS10, DFII10, DTWEXBGS, T10YIE (Blueprint §4.4).
 */
const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';

function sanitize(s) {
  if (!s) return s;
  return String(s).replace(/api_key=[^&\s]*/gi, 'api_key=[redacted]');
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
  const { apikey, series_id, limit } = body || {};
  if (!apikey || typeof apikey !== 'string' || apikey.length < 8) {
    return res.status(400).json({ error: 'Thiếu API key FRED (lấy miễn phí tại fred.stlouisfed.org).' });
  }
  const sid = String(series_id || '').toUpperCase();
  if (!/^(DGS2|DGS10|DFII10|DTWEXBGS|T10YIE)$/.test(sid)) {
    return res.status(400).json({ error: 'Chuỗi không hỗ trợ. Chỉ: DGS2, DGS10, DFII10, DTWEXBGS, T10YIE.' });
  }

  const qs = new URLSearchParams({
    series_id: sid,
    api_key: apikey,
    file_type: 'json',
    sort_order: 'desc',
    limit: String(Math.min(Math.max(parseInt(limit) || 10, 2), 30)),
  });
  const url = `${FRED_BASE}?${qs.toString()}`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'NexusPilot/1.0' } });
    const text = await r.text();
    let d;
    try { d = JSON.parse(text); } catch { throw new Error('FRED không trả về JSON.'); }
    if (!r.ok) throw new Error(d?.error_message || `FRED lỗi HTTP ${r.status}.`);
    return res.status(200).json(d);
  } catch (e) {
    return res.status(502).json({ error: `Lỗi proxy FRED: ${sanitize(e.message)}` });
  }
}
