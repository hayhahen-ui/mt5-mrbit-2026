/**
 * aiClient.ts — Gọi model AI qua proxy nội bộ /api/ai-proxy.
 * Key lấy từ kho localStorage của user, gửi kèm mỗi request (proxy không lưu).
 */
import { getActiveProvider, getAiKey } from './aiKeys';
import { readApiJson } from './apiHealth';
import { apiUrl } from './apiHealth';

export interface AiChatMessage { role: 'user' | 'assistant' | 'system'; content: string }

async function callProxy(payload: Record<string, unknown>) {
  const r = await fetch(apiUrl('/api/ai-proxy'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const d = await readApiJson(r, 'AI');
  return d as { ok: boolean; valid?: boolean; content?: string; error?: string };
}

/** Kiểm tra key có hợp lệ không (dùng khi user bấm "Kiểm tra kết nối") */
export async function validateAiKey(providerId: string, apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const d = await callProxy({ action: 'validate', providerId, apiKey });
    if (typeof d.valid === 'boolean') return { valid: d.valid, error: d.error };
    return { valid: false, error: d.error || 'Không kiểm tra được.' };
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : 'Lỗi mạng.' };
  }
}

export interface AiChatResult { content: string; provider: string; model: string }

/** Chat với provider đang active — ném Error khi chưa cấu hình hoặc provider lỗi */
export async function aiChat(messages: AiChatMessage[], maxTokens = 1024): Promise<AiChatResult> {
  const active = getActiveProvider();
  if (!active) throw new Error('Chưa cấu hình AI. Vào HELP → CÀI ĐẶT AI để nhập API key.');
  const apiKey = getAiKey(active.provider);
  if (!apiKey) throw new Error('Chưa có API key cho provider đang chọn.');
  const d = await callProxy({
    action: 'chat', providerId: active.provider, apiKey,
    model: active.model, messages, maxTokens,
  });
  if (!d.ok || !d.content) {
    throw new Error(d.error || 'AI không trả về nội dung.');
  }
  return { content: d.content, provider: active.provider, model: active.model };
}
