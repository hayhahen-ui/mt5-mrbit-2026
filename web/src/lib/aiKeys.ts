/**
 * aiKeys.ts — Kho API key của user, lưu ở localStorage TRÊN MÁY USER.
 * - Key không bao giờ gửi đi đâu ngoài provider do user chọn (qua /api/ai-proxy).
 * - UI chỉ hiện dạng ••••abcd (4 ký tự cuối).
 */
import { AiProviderId, getProviderMeta } from './aiProviders';

const KEYS_KEY = 'nexuspilot-ai-keys-v1';
const ACTIVE_KEY = 'nexuspilot-ai-active-v1';

interface KeyEntry { key: string; savedAt: number }
type KeyMap = Partial<Record<AiProviderId, KeyEntry>>;

function readKeys(): KeyMap {
  try {
    const raw = localStorage.getItem(KEYS_KEY);
    const o = raw ? JSON.parse(raw) : {};
    return typeof o === 'object' && o ? o : {};
  } catch { return {}; }
}

function writeKeys(m: KeyMap) {
  try { localStorage.setItem(KEYS_KEY, JSON.stringify(m)); } catch { /* bỏ qua */ }
}

export function saveAiKey(provider: AiProviderId, apiKey: string): void {
  const m = readKeys();
  m[provider] = { key: apiKey.trim(), savedAt: Date.now() };
  writeKeys(m);
}

export function getAiKey(provider: AiProviderId): string | null {
  return readKeys()[provider]?.key || null;
}

export function removeAiKey(provider: AiProviderId): void {
  const m = readKeys();
  delete m[provider];
  writeKeys(m);
  const active = getActiveProvider();
  if (active?.provider === provider) {
    try { localStorage.removeItem(ACTIVE_KEY); } catch { /* noop */ }
  }
}

/** "••••abcd" — hiện ở UI, không bao giờ hiện key đầy đủ */
export function keyHint(provider: AiProviderId): string | null {
  const k = getAiKey(provider);
  return k ? `••••${k.slice(-4)}` : null;
}

export function hasAiKey(provider: AiProviderId): boolean {
  return !!getAiKey(provider);
}

export interface ActiveAi { provider: AiProviderId; model: string }

export function getActiveProvider(): ActiveAi | null {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    const meta = getProviderMeta(o.provider);
    if (!meta || !meta.supportsChat) return null;
    if (!hasAiKey(o.provider)) return null;
    return {
      provider: o.provider as AiProviderId,
      model: typeof o.model === 'string' && o.model ? o.model : meta.defaultModel,
    };
  } catch { return null; }
}

export function setActiveProvider(provider: AiProviderId, model: string): void {
  try {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify({ provider, model }));
  } catch { /* bỏ qua */ }
}
