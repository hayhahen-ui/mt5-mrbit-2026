/**
 * /api/shared.js — Proxy journal chia sẻ đa thiết bị.
 *
 * Khi user chia sẻ link app (kèm ?g=GROUP_ID), mọi thiết bị mở link đều có thể
 * ghi giao dịch vào kho chung; chủ link xem được toàn bộ.
 *
 * - POST { group, deviceId, deviceName, entries } → append vào
 *   shared/{group}/log.jsonl + cập nhật shared/{group}/devices/{deviceId}.json (nhánh data)
 * - GET ?group=XXX → trả về toàn bộ log + danh sách thiết bị của nhóm
 *
 * Dùng GITHUB_DATA_PAT (server-side, Vercel env) — thiết bị khách KHÔNG cần PAT.
 * Giới hạn: group ID 4-16 ký tự [A-Z0-9-], mỗi request tối đa 200 entries.
 */
const REPO = 'hayhahen-ui/mt5-mrbit-2026';
const BRANCH = 'data';

function sanitize(s) {
  if (!s) return s;
  return String(s).replace(/ghp_[A-Za-z0-9_]+/g, '[redacted]').slice(0, 300);
}

async function gh(path, pat, init) {
  const r = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${pat}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...((init && init.headers) || {}),
    },
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`GitHub ${r.status}: ${t.slice(0, 150)}`);
  }
  return r.json();
}

const b64e = (s) => Buffer.from(s, 'utf8').toString('base64');
const b64d = (s) => Buffer.from(s.replace(/\n/g, ''), 'base64').toString('utf8');
const validGroup = (g) => typeof g === 'string' && /^[A-Z0-9-]{4,16}$/.test(g);

async function getFile(path, pat) {
  try {
    const cur = await gh(`/repos/${REPO}/contents/${path}?ref=${BRANCH}`, pat);
    return { sha: cur.sha, content: b64d(cur.content || '') };
  } catch (e) {
    if (String(e.message || '').includes('404')) return { sha: null, content: '' };
    throw e;
  }
}

async function putFile(path, pat, content, message) {
  const { sha } = await getFile(path, pat);
  await gh(`/repos/${REPO}/contents/${path}`, pat, {
    method: 'PUT',
    body: JSON.stringify({ message, content: b64e(content), branch: BRANCH, ...(sha ? { sha } : {}) }),
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const pat = process.env.GITHUB_DATA_PAT;
  if (!pat) return res.status(500).json({ error: 'Server chưa cấu hình GITHUB_DATA_PAT.' });

  try {
    if (req.method === 'GET') {
      const group = String(req.query.group || '').toUpperCase();
      if (!validGroup(group)) return res.status(400).json({ error: 'Thiếu group ID hợp lệ.' });
      const logPath = `shared/${group}/log.jsonl`;
      const { content } = await getFile(logPath, pat);
      const entries = content.split('\n').filter(Boolean).map((l) => {
        try { return JSON.parse(l); } catch { return null; }
      }).filter(Boolean);
      // Danh sách thiết bị (từ entries)
      const devices = {};
      for (const e of entries) {
        if (e.deviceId) {
          devices[e.deviceId] = devices[e.deviceId] || { deviceId: e.deviceId, deviceName: e.deviceName || e.deviceId, count: 0, lastAt: 0 };
          devices[e.deviceId].count++;
          if (e.ts > devices[e.deviceId].lastAt) devices[e.deviceId].lastAt = e.ts;
        }
      }
      return res.status(200).json({ group, entries: entries.slice(-1000), devices: Object.values(devices) });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Body JSON không hợp lệ.' }); }
      }
      const group = String(body.group || '').toUpperCase();
      const { deviceId, deviceName, entries } = body || {};
      if (!validGroup(group)) return res.status(400).json({ error: 'group ID không hợp lệ (4-16 ký tự A-Z0-9-).' });
      if (!deviceId || typeof deviceId !== 'string' || deviceId.length > 64) {
        return res.status(400).json({ error: 'Thiếu deviceId.' });
      }
      const list = Array.isArray(entries) ? entries.slice(0, 200) : [];
      if (list.length === 0) return res.status(200).json({ ok: true, pushed: 0 });

      // Sanitize từng entry: chỉ giữ trường cho phép
      const clean = list.map((e) => ({
        ts: Number(e.ts) || Date.now(),
        type: String(e.type || 'trade').slice(0, 20),
        symbol: String(e.symbol || '').slice(0, 20),
        direction: String(e.direction || '').slice(0, 10),
        entry: Number(e.entry) || null,
        exit: Number(e.exit) || null,
        lot: Number(e.lot) || null,
        pnl: Number(e.pnl) || null,
        rMultiple: Number(e.rMultiple) || null,
        outcome: String(e.outcome || '').slice(0, 20),
        note: String(e.note || '').slice(0, 200),
        deviceId: String(deviceId).slice(0, 64),
        deviceName: String(deviceName || deviceId).slice(0, 64),
      }));

      const logPath = `shared/${group}/log.jsonl`;
      const { sha, content } = await getFile(logPath, pat);
      const lines = clean.map((e) => JSON.stringify(e)).join('\n') + '\n';
      await gh(`/repos/${REPO}/contents/${logPath}`, pat, {
        method: 'PUT',
        body: JSON.stringify({
          message: `shared ${group}: +${clean.length} entries (${String(deviceId).slice(0, 8)})`,
          content: b64e(content + lines),
          branch: BRANCH,
          ...(sha ? { sha } : {}),
        }),
      });

      // Cập nhật trạng thái thiết bị
      const devPath = `shared/${group}/devices/${encodeURIComponent(String(deviceId).slice(0, 64))}.json`;
      await putFile(devPath, pat, JSON.stringify({
        deviceId, deviceName: String(deviceName || deviceId).slice(0, 64),
        lastSeen: new Date().toISOString(), entriesPushed: clean.length,
      }, null, 1), `shared ${group}: heartbeat ${String(deviceId).slice(0, 8)}`);

      return res.status(200).json({ ok: true, pushed: clean.length });
    }

    return res.status(405).json({ error: 'GET/POST only' });
  } catch (e) {
    return res.status(502).json({ error: `Lỗi shared proxy: ${sanitize(e.message)}` });
  }
}
