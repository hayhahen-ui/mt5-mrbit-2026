/**
 * /api/myfxbook-outlook — Proxy lấy Community Outlook (tâm lý đám đông) từ MyFxBook.
 *
 * POST { email, password } → login.json lấy session → get-community-outlook.json
 *
 * BẢO MẬT:
 * - Email/password của user: nhận mỗi request, KHÔNG lưu, KHÔNG log, KHÔNG echo lại.
 * - Lỗi sanitize: thay mọi xuất hiện của email/password bằng [redacted].
 * - MyFxBook giới hạn tài khoản free: poll tối đa 15 phút/lần (client tự cache).
 */
const LOGIN_URL = 'https://www.myfxbook.com/api/login.json';
const OUTLOOK_URL = 'https://www.myfxbook.com/api/get-community-outlook.json';

function sanitize(text, secrets) {
  let s = String(text ?? '');
  for (const sec of secrets) {
    if (sec && sec.length >= 3) s = s.split(sec).join('[redacted]');
  }
  return s.length > 600 ? s.slice(0, 600) + '…' : s;
}

async function fetchTimeout(url, init, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function doLogin(email, password) {
  const url = `${LOGIN_URL}?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
  const r = await fetchTimeout(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 20000);
  const text = await r.text();
  let d;
  try { d = JSON.parse(text); } catch { throw new Error('MyFxBook không trả về JSON khi đăng nhập.'); }
  if (d.error || !d.session) {
    throw new Error(`Đăng nhập MyFxBook thất bại: ${d.message || 'kiểm tra email/password.'}`);
  }
  return d.session;
}

async function fetchOutlook(session) {
  const r = await fetchTimeout(
    `${OUTLOOK_URL}?session=${encodeURIComponent(session)}`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } },
    20000,
  );
  const text = await r.text();
  let d;
  try { d = JSON.parse(text); } catch { throw new Error('MyFxBook không trả về JSON outlook.'); }
  if (d.error) throw new Error(`Outlook lỗi: ${d.message || 'session không hợp lệ.'}`);
  const arr = Array.isArray(d.symbols) ? d.symbols : [];
  return arr.map((s) => ({
    symbol: String(s.name || '').toUpperCase(),
    longPct: Number(s.longPercentage ?? 0),
    shortPct: Number(s.shortPercentage ?? 0),
    longPositions: Number(s.longPositions ?? 0),
    shortPositions: Number(s.shortPositions ?? 0),
    totalPositions: Number(s.totalPositions ?? 0),
  })).filter((s) => s.symbol);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const email = String(body?.email || '').trim();
  const password = String(body?.password || '');
  const secrets = [email, password];
  // KHÔNG log email/password ở bất cứ đâu

  if (!email || password.length < 1) {
    return res.status(400).json({ ok: false, error: 'Thiếu email/password MyFxBook.' });
  }

  try {
    const session = await doLogin(email, password);
    let symbols;
    try {
      symbols = await fetchOutlook(session);
    } catch {
      // Session có thể hết hạn — login lại 1 lần rồi thử lại
      const session2 = await doLogin(email, password);
      symbols = await fetchOutlook(session2);
    }
    // Logout để gọn session (best-effort)
    fetchTimeout(`https://www.myfxbook.com/api/logout.json?session=${encodeURIComponent(session)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }, 8000).catch(() => {});
    return res.status(200).json({ ok: true, symbols, fetchedAt: new Date().toISOString() });
  } catch (e) {
    return res.status(200).json({ ok: false, error: sanitize(e instanceof Error ? e.message : String(e), secrets) });
  }
}
