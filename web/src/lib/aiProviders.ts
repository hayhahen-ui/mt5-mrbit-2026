/**
 * aiProviders.ts — Metadata PUBLIC các nền tảng AI (không chứa secret/baseUrl).
 * Port từ backend NestJS (ai.providers.ts): giữ id/name/keyUrl/models/mô tả.
 * baseUrl + kind nằm ở api/_providers.js (server-side) — frontend không thấy.
 */

export type AiProviderId =
  | 'gemini' | 'openai' | 'xai' | 'anthropic' | 'deepseek'
  | 'experientiallabs' | 'apmix' | 'muse' | 'groq' | 'moonshot'
  | 'tinyfish' | 'pollinations' | 'vyceai' | 'koto' | 'apinex';

export interface AiProviderMeta {
  id: AiProviderId;
  name: string;
  /** Link chính thức để user tự tạo API key (key của user) */
  keyUrl: string;
  models: string[];
  defaultModel: string;
  description: string;
  keyNote?: string;
  /** false = API tiện ích (search/ảnh), không phải model chat → ẩn khỏi ô chọn chat */
  supportsChat: boolean;
}

export const SUPPORTED_PROVIDERS: AiProviderMeta[] = [
  { id: 'gemini', name: 'Google Gemini', keyUrl: 'https://aistudio.google.com/apikey',
    models: ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-pro-preview'],
    defaultModel: 'gemini-3.6-flash',
    description: 'Miễn phí hào phóng, tốc độ nhanh, tốt cho tác vụ hàng ngày.',
    keyNote: 'Key miễn phí', supportsChat: true },
  { id: 'openai', name: 'ChatGPT (OpenAI)', keyUrl: 'https://platform.openai.com/api-keys',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'], defaultModel: 'gpt-4o-mini',
    description: 'Chất lượng cao, hệ sinh thái lớn, nhiều model lựa chọn.', supportsChat: true },
  { id: 'xai', name: 'Grok (xAI)', keyUrl: 'https://console.x.ai',
    models: ['grok-3-mini', 'grok-3', 'grok-4'], defaultModel: 'grok-3-mini',
    description: 'Cập nhật kiến thức nhanh, phong cách trả lời thẳng thắn.',
    keyNote: 'Cần tài khoản có thanh toán', supportsChat: true },
  { id: 'anthropic', name: 'Claude (Anthropic)', keyUrl: 'https://console.anthropic.com',
    models: ['claude-haiku-4-5', 'claude-sonnet-4-5', 'claude-opus-4-1'],
    defaultModel: 'claude-haiku-4-5',
    description: 'Viết lách và lập luận xuất sắc, context dài.', supportsChat: true },
  { id: 'deepseek', name: 'DeepSeek', keyUrl: 'https://platform.deepseek.com',
    models: ['deepseek-chat', 'deepseek-reasoner'], defaultModel: 'deepseek-chat',
    description: 'Chi phí thấp, mạnh về code và toán.', supportsChat: true },
  { id: 'experientiallabs', name: 'ExperientialLabs', keyUrl: 'https://platform.experientiallabs.ai/models/grok-4.7',
    models: ['gpt-5.6-luna', 'deepseek-v4-flash', 'deepseek-v4.1-flash', 'grok-4.7'],
    defaultModel: 'gpt-5.6-luna',
    description: 'Chuẩn OpenAI. Có model FREE (gpt-5.6-luna test tốt).',
    keyNote: 'Có model miễn phí', supportsChat: true },
  { id: 'apmix', name: 'Apmix', keyUrl: 'https://apmix.ai/dashboard',
    models: ['deepseek/deepseek-v4-flash-free', 'openai/gpt-6-luna-free'],
    defaultModel: 'deepseek/deepseek-v4-flash-free',
    description: 'Miễn phí — model DeepSeek free + GPT free qua Apmix, nhập key là chạy ngay.',
    keyNote: 'Có gói miễn phí', supportsChat: true },
  { id: 'muse', name: 'Muse (Meta)', keyUrl: 'https://dev.meta.ai',
    models: ['muse-spark-1.3', 'muse-spark-1.2', 'muse-spark-1.1'], defaultModel: 'muse-spark-1.3',
    description: 'Model dòng Muse của Meta qua Model API (chuẩn OpenAI).',
    keyNote: 'Tạo key tại dev.meta.ai', supportsChat: true },
  { id: 'groq', name: 'Groq', keyUrl: 'https://console.groq.com/keys',
    models: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'llama-3.3-70b-versatile'],
    defaultModel: 'openai/gpt-oss-120b',
    description: 'Inference siêu nhanh trên chip LPU, có key miễn phí. Chuẩn OpenAI.',
    keyNote: 'Key miễn phí', supportsChat: true },
  { id: 'moonshot', name: 'Kimi (Moonshot AI)', keyUrl: 'https://platform.moonshot.ai/console/api-keys',
    models: ['kimi-k3', 'kimi-k2.5', 'moonshot-v1-8k'], defaultModel: 'kimi-k3',
    description: 'Dòng model Kimi của Moonshot AI, context dài.', supportsChat: true },
  { id: 'tinyfish', name: 'TinyFish', keyUrl: 'https://agent.tinyfish.ai/api-keys',
    models: [], defaultModel: '',
    description: 'Search & Fetch API cho AI agent (không phải model chat): nguồn tìm kiếm web có cấu trúc.',
    keyNote: 'Search + Fetch miễn phí', supportsChat: false },
  { id: 'pollinations', name: 'Pollinations.ai', keyUrl: 'https://enter.pollinations.ai',
    models: [], defaultModel: '',
    description: 'Tạo ảnh AI miễn phí (FLUX) — không phải model chat.',
    keyNote: 'Tạo ảnh miễn phí', supportsChat: false },
  { id: 'vyceai', name: 'VyceAI', keyUrl: 'https://vyceai.com/dashboard-v2',
    models: ['deepseek-v4-flash', 'deepseek-v4.1', 'gpt-6-luna', 'claude-sonnet-4-6', 'agnes-3.0-flash'],
    defaultModel: 'claude-sonnet-4-6',
    description: 'Gateway chuẩn OpenAI giá rẻ + tạo ảnh. Trừ balance theo dùng.',
    keyNote: 'Trừ balance theo dùng', supportsChat: true },
  { id: 'koto', name: 'KOTO (Mutowa)', keyUrl: 'https://koto.mutowa.com/',
    models: ['KOTO-super-1.2', 'KOTO-super-heavy-2', 'KOTO-flash-1.2'],
    defaultModel: 'KOTO-super-1.2',
    description: 'Chat chuẩn OpenAI từ Mutowa (Nhật), context tới 2M token.',
    keyNote: 'Dùng credits tài khoản KOTO', supportsChat: true },
  { id: 'apinex', name: 'APInex', keyUrl: 'https://apinex.bond/',
    models: ['free/qwen-3.8-max', 'free/deepseek-v4.1-flash', 'free/gpt-6-luna', 'free/kimi-k3', 'free/gemini-3.8-flash'],
    defaultModel: 'free/qwen-3.8-max',
    description: 'Gateway chuẩn OpenAI với nhiều model FREE, context 1M.',
    keyNote: 'Nhiều model miễn phí', supportsChat: true },
];

export function getProviderMeta(id: string): AiProviderMeta | undefined {
  return SUPPORTED_PROVIDERS.find((p) => p.id === id);
}

export const CHAT_PROVIDERS = SUPPORTED_PROVIDERS.filter((p) => p.supportsChat);
