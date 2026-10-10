/**
 * _providers.js — Metadata NỘI BỘ (server-side) cho /api/ai-proxy.js.
 * Port từ backend NestJS: baseUrl + kind KHÔNG bao giờ trả về client.
 */
const PROVIDERS = {
  gemini:           { baseUrl: 'https://generativelanguage.googleapis.com', kind: 'gemini' },
  openai:           { baseUrl: 'https://api.openai.com/v1',                 kind: 'openai-compatible' },
  xai:              { baseUrl: 'https://api.x.ai/v1',                       kind: 'openai-compatible' },
  anthropic:        { baseUrl: 'https://api.anthropic.com',                 kind: 'anthropic' },
  deepseek:         { baseUrl: 'https://api.deepseek.com/v1',               kind: 'openai-compatible' },
  experientiallabs: { baseUrl: 'https://api.experientiallabs.ai/v1',       kind: 'openai-compatible' },
  apmix:            { baseUrl: 'https://api.apmix.ai/v1',                  kind: 'openai-compatible' },
  muse:             { baseUrl: 'https://api.meta.ai/v1',                   kind: 'openai-compatible' },
  groq:             { baseUrl: 'https://api.groq.com/openai/v1',            kind: 'openai-compatible' },
  moonshot:         { baseUrl: 'https://api.moonshot.ai/v1',                kind: 'openai-compatible' },
  vyceai:           { baseUrl: 'https://vyceai.com/v1',                     kind: 'openai-compatible' },
  koto:             { baseUrl: 'https://api.mutowa.com/v1',                 kind: 'openai-compatible' },
  apinex:           { baseUrl: 'https://api.apinex.bond/v1',                kind: 'openai-compatible' },
};

export function getInternalMeta(providerId) {
  return PROVIDERS[providerId] || null;
}
