/**
 * /api/positions.js — Kho vị thế server-side (nấc 2: Naive auto-operation).
 *
 * GET  ?status=open|closed|all&limit=100   → liệt kê vị thế
 * POST {symbol,type,lot,entryPrice,sl,tp,tier?,autoClose?,deviceId?,created_by?,signalScore?}
 *      → mở lệnh (ghi cả từ browser dual-write lẫn agent)
 *
 * Guardrails server-enforced cho lệnh agent (created_by=agent, cần Bearer NAIVE_AGENT_KEY):
 * - lot ≤ 0.02, signalScore ≥ 80, tối đa 3 lệnh agent đang mở
 * - không trùng symbol+chiều đang mở của agent
 * - account_state tươi (<30') + margin khả dụng đủ
 * - cờ halt_agent_trading_until (risk-manager đặt) còn hiệu lực → từ chối
 * Lệnh browser: validate cơ bản + max 5 lệnh mở tổng.
 */
import { configured, cors, agentAuth, q, ins, marginOf, logAction } from '../../api/_supa.js';

const MAX_OPEN_TOTAL = 5;
const MAX_OPEN_AGENT = 3;
const AGENT_MAX_LOT = 0.02;
const AGENT_MIN_SCORE = 80;
const STATE_STALE_MS = 30 * 60 * 1000;

async function getFlag(key) {
  const rows = await q('/flags', { key: `eq.${key}`, select: 'value,updated_at', limit: 1 });
  return rows && rows[0] ? rows[0] : null;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!configured()) return res.status(503).json({ ok: false, error: 'Server chưa cấu hình Supabase (SUPABASE_URL/SUPABASE_SERVICE_KEY). App chạy local-only.' });

  try {
    if (req.method === 'GET') {
      const status = String(req.query.status || 'open');
      const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
      const params = { select: '*', order: 'opened_at.desc', limit: String(limit) };
      if (status !== 'all') params.status = `eq.${status}`;
      const positions = await q('/positions', params);
      return res.status(200).json({ ok: true, positions });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { return res.status(400).json({ ok: false, error: 'Body JSON không hợp lệ.' }); }
      }
      const createdBy = body.created_by === 'agent' ? 'agent' : 'browser';
      const agentName = String(body.agent || (createdBy === 'agent' ? 'naive-agent' : 'browser')).slice(0, 64);
      if (createdBy === 'agent' && !agentAuth(req)) {
        return res.status(401).json({ ok: false, error: 'Thiếu Bearer NAIVE_AGENT_KEY.' });
      }

      // Validate cơ bản
      const symbol = String(body.symbol || '').toUpperCase().slice(0, 20);
      const type = String(body.type || '').toUpperCase();
      const lot = Number(body.lot);
      const entryPrice = Number(body.entryPrice);
      const sl = Number(body.sl);
      const tp = Number(body.tp);
      if (!symbol) return res.status(400).json({ ok: false, error: 'Thiếu symbol.' });
      if (type !== 'BUY' && type !== 'SELL') return res.status(400).json({ ok: false, error: 'type phải là BUY/SELL (không chấp nhận FLAT).' });
      if (!(lot >= 0.01)) return res.status(400).json({ ok: false, error: 'lot tối thiểu 0.01.' });
      if (!(entryPrice > 0) || !(sl > 0) || !(tp > 0)) {
        return res.status(400).json({ ok: false, error: 'entryPrice/sl/tp phải > 0.' });
      }
      // SL/TP đúng chiều
      if (type === 'BUY' && !(sl < entryPrice && tp > entryPrice)) {
        return res.status(400).json({ ok: false, error: 'BUY: SL phải dưới entry, TP trên entry.' });
      }
      if (type === 'SELL' && !(sl > entryPrice && tp < entryPrice)) {
        return res.status(400).json({ ok: false, error: 'SELL: SL phải trên entry, TP dưới entry.' });
      }

      const open = await q('/positions', { status: 'eq.open', select: 'id,symbol,type,lot,entry_price,created_by', limit: 100 });
      if (open.length >= MAX_OPEN_TOTAL) {
        return res.status(409).json({ ok: false, error: `Đã đạt tối đa ${MAX_OPEN_TOTAL} lệnh mở.` });
      }

      if (createdBy === 'agent') {
        // Cờ halt của risk-manager
        const halt = await getFlag('halt_agent_trading_until');
        if (halt && new Date(halt.value).getTime() > Date.now()) {
          return res.status(423).json({ ok: false, error: `Agent trading đang bị khóa đến ${halt.value} (risk-manager).` });
        }
        const agentOpen = open.filter((p) => p.created_by === 'agent');
        if (agentOpen.length >= MAX_OPEN_AGENT) {
          return res.status(409).json({ ok: false, error: `Agent đã đạt tối đa ${MAX_OPEN_AGENT} lệnh mở.` });
        }
        if (!(lot <= AGENT_MAX_LOT)) {
          return res.status(400).json({ ok: false, error: `Agent chỉ được mở tối đa ${AGENT_MAX_LOT} lot/lệnh.` });
        }
        const score = Number(body.signalScore);
        if (!(score >= AGENT_MIN_SCORE)) {
          return res.status(400).json({ ok: false, error: `Agent chỉ được mở khi signalScore ≥ ${AGENT_MIN_SCORE}.` });
        }
        if (agentOpen.some((p) => p.symbol === symbol && p.type === type)) {
          return res.status(409).json({ ok: false, error: `Agent đã có lệnh ${type} ${symbol} đang mở.` });
        }
        // Margin check cần account_state tươi (do trình duyệt đẩy lên)
        const st = await q('/account_state', { id: 'eq.1', select: '*', limit: 1 });
        const s = st && st[0];
        if (!s || Date.now() - new Date(s.updated_at).getTime() > STATE_STALE_MS) {
          return res.status(409).json({ ok: false, error: 'account_state quá cũ (>30\'). Mở trình duyệt để đồng bộ rồi thử lại.' });
        }
        const need = marginOf({ symbol, lot, entryPrice });
        if (Number(s.used_margin) + need > Number(s.equity)) {
          return res.status(409).json({ ok: false, error: `Margin không đủ: cần $${need.toFixed(2)}, khả dụng $${(Number(s.equity) - Number(s.used_margin)).toFixed(2)}.` });
        }
      }

      const genId = `POS-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      // Nhận id từ client (browser) để retry idempotent; validate format, fallback tự sinh
      const id = /^[A-Z0-9-]{8,64}$/.test(String(body.id || '')) ? String(body.id) : genId;
      const row = {
        id,
        symbol, type, lot, entry_price: entryPrice, sl, tp,
        tier: String(body.tier || 'SINGLE').slice(0, 10),
        status: 'open',
        auto_close: body.autoClose || {},
        device_id: String(body.deviceId || '').slice(0, 64) || null,
        kaizen_id: String(body.kaizenId || '').slice(0, 64) || null,
        signal_score: createdBy === 'agent' ? Number(body.signalScore) : null,
        created_by: createdBy,
      };
      const created = await ins('/positions', [row]).catch(async (e) => {
        // 409 = id đã tồn tại (retry sau F5) → coi như đã đồng bộ
        if (String(e.message || '').includes('409')) return [row];
        throw e;
      });
      await logAction({ agent: agentName, action: 'open', position_id: id, params: { symbol, type, lot }, result: 'ok' });
      return res.status(200).json({ ok: true, position: (created && created[0]) || row });
    }

    return res.status(405).json({ ok: false, error: 'GET/POST only' });
  } catch (e) {
    return res.status(502).json({ ok: false, error: `Lỗi positions API: ${String(e.message || e).slice(0, 200)}` });
  }
}
