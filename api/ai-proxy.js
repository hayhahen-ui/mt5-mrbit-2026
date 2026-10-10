/**
 * /api/ai-proxy — Proxy gọi model AI của user (port backend NestJS ai.service.ts).
 *
 * POST { action: 'validate' | 'chat', providerId, apiKey, model?, messages?, maxTokens? }
 *
 * BẢO MẬT:
 * - API key của user: nhận mỗi request, KHÔNG lưu, KHÔNG log.
 * - Mọi lỗi trả về đều được sanitize (key → [redacted]).
 * - Chạy server-side nên không dính CORS; baseUrl/kind không bao giờ lộ ra client.
 */
import { getInternalMeta } from './_providers.js';

const VALIDATE_TIMEOUT_MS = 10_000;
const CHAT_TIMEOUT_MS = 90_000;

function sanitize(text, apiKey) {
  const s = String(text ?? '');
  const cut = s.length > 500 ? s.slice(0, 500) + '…' : s;
  return apiKey ? cut.split(apiKey).join('[redacted]') : cut;
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

// ─── Validate key (1 call nhẹ) ─────────────────────────────────────────────

async function validateKey(meta, apiKey) {
  const { baseUrl, kind } = meta;
  if (kind === 'gemini') {
    const r = await fetchTimeout(`${baseUrl}/v1beta/models?key=${encodeURIComponent(apiKey)}`, {}, VALIDATE_TIMEOUT_MS);
    return r.ok;
  }
  if (kind === 'anthropic') {
    // Anthropic không có endpoint check key → 1 messages call tối thiểu.
    // 401/403 = key sai; 404/not_found_error = key đúng nhưng model không tồn tại.
    const r = await fetchTimeout(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] }),
    }, VALIDATE_TIMEOUT_MS);
    if (r.ok) return true;
    if (r.status === 401 || r.status === 403) return false;
    try {
      const d = await r.json();
      const type = d?.error?.type ?? '';
      if (type === 'not_found_error' || r.status === 404) return true;
      if (type === 'authentication_error') return false;
    } catch { /* không kết luận */ }
    return false;
  }
  // openai-compatible: GET /models, 401/403 = key sai
  const r = await fetchTimeout(`${baseUrl}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  }, VALIDATE_TIMEOUT_MS);
  if (r.status === 401 || r.status === 403) return false;
  return r.ok;
}

// ─── Chat (3 dialect) ──────────────────────────────────────────────────────

function toOpenAiMessages(messages) {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

async function chatGemini(meta, apiKey, model, messages, maxTokens) {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  const r = await fetchTimeout(
    `${meta.baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents,
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    },
    CHAT_TIMEOUT_MS,
  );
  const text = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0, 300)}`);
  const d = JSON.parse(text);
  const content = d.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!content) throw new Error('Provider không trả về nội dung.');
  return content;
}

async function chatOpenAiCompatible(meta, apiKey, model, messages, maxTokens) {
  const r = await fetchTimeout(`${meta.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: toOpenAiMessages(messages), max_tokens: maxTokens }),
  }, CHAT_TIMEOUT_MS);
  const text = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0, 300)}`);
  const d = JSON.parse(text);
  const content = d.choices?.[0]?.message?.content ?? '';
  if (!content) throw new Error('Provider không trả về nội dung.');
  return content;
}

async function chatAnthropic(meta, apiKey, model, messages, maxTokens) {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const rest = messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: m.content }));
  const r = await fetchTimeout(`${meta.baseUrl}/v1/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model, max_tokens: maxTokens,
      ...(system ? { system } : {}),
      messages: rest,
    }),
  }, CHAT_TIMEOUT_MS);
  const text = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0, 300)}`);
  const d = JSON.parse(text);
  const content = d.content?.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('') ?? '';
  if (!content) throw new Error('Provider không trả về nội dung.');
  return content;
}

async function chat(meta, apiKey, model, messages, maxTokens) {
  if (meta.kind === 'gemini') return chatGemini(meta, apiKey, model, messages, maxTokens);
  if (meta.kind === 'anthropic') return chatAnthropic(meta, apiKey, model, messages, maxTokens);
  return chatOpenAiCompatible(meta, apiKey, model, messages, maxTokens);
}

// ─── Handler ───────────────────────────────────────────────────────────────

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
  const { action, providerId, apiKey, model, messages, maxTokens } = body || {};

  // KHÔNG log apiKey ở bất cứ đâu
  if (typeof apiKey !== 'string' || apiKey.trim().length < 8) {
    return res.status(400).json({ ok: false, error: 'Thiếu API key hợp lệ.' });
  }
  const meta = getInternalMeta(String(providerId || ''));
  if (!meta) return res.status(400).json({ ok: false, error: 'Provider không được hỗ trợ.' });

  try {
    if (action === 'validate') {
      const valid = await validateKey(meta, apiKey.trim());
      return res.status(200).json({ ok: true, valid });
    }
    if (action === 'chat') {
      if (!Array.isArray(messages) || messages.length === 0 || messages.length > 50) {
        return res.status(400).json({ ok: false, error: 'messages không hợp lệ (1–50).' });
      }
      const content = await chat(meta, apiKey.trim(), String(model || '').trim() || 'default', messages, Math.min(Math.max(Number(maxTokens) || 1024, 1), 4096));
      return res.status(200).json({ ok: true, content });
    }
    return res.status(400).json({ ok: false, error: 'action phải là validate | chat.' });
  } catch (e) {
    const msg = sanitize(e instanceof Error ? e.message : String(e), apiKey.trim());
    // 401/403 từ provider → key có vấn đề (báo rõ để user kiểm tra lại)
    const invalid = /HTTP (401|403)\b/.test(msg);
    return res.status(200).json({ ok: false, valid: invalid ? false : undefined, error: msg });
  }
}
