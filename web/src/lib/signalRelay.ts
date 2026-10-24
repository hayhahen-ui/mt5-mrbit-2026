/**
 * signalRelay.ts — Cầu nối Cockpit NexusPilot -> Bot Telegram (@Nexuspilot90_bot).
 *
 * Khi useMarketData sinh một tín hiệu MỚI đạt chuẩn, module này POST tín hiệu
 * về endpoint /api/signal-relay của bot (bot-tele-2026.vercel.app). Phía bot
 * sẽ lọc lại theo ngưỡng, chống trùng và phát lên Telegram.
 *
 * Cấu hình qua biến môi trường của frontend (Vite):
 * - VITE_SIGNAL_KEY: khóa chia sẻ với bot (bot đặt SIGNAL_KEY cùng giá trị).
 *   Chưa đặt khóa -> relay tự tắt, không gửi gì.
 * - VITE_SIGNAL_MIN_SCORE: ngưỡng điểm % tối thiểu (mặc định 80).
 * - VITE_SIGNAL_RELAY_URL: đổi endpoint nếu cần (mặc định bot production).
 *
 * Chống trùng phía client: cùng symbol + direction + engine chỉ gửi lại sau
 * 30 phút (lưu localStorage). Phía bot cũng chống trùng độc lập.
 */
import type { Signal } from '../types';
import { totalScore } from './scoring';

const RELAY_URL =
  (import.meta as any).env?.VITE_SIGNAL_RELAY_URL ||
  'https://bot-tele-2026.vercel.app/api/signal-relay';
const RELAY_KEY: string = (import.meta as any).env?.VITE_SIGNAL_KEY || '';
const MIN_SCORE_PCT: number = Number(
  (import.meta as any).env?.VITE_SIGNAL_MIN_SCORE || 80
);
const DEDUPE_MS = 30 * 60 * 1000;
const LS_KEY = 'nexus_signal_relay_sent_v1';

function scorePct(signal: Signal): number {
  const factors = signal.scoreBreakdown || [];
  const max = factors.reduce((acc, f) => acc + (f.maxPoints || 0), 0);
  if (max <= 0) return 0;
  return Math.round((totalScore(factors) / max) * 100);
}

function alreadySent(key: string): boolean {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    const last = map[key] || 0;
    if (Date.now() - last < DEDUPE_MS) return true;
    map[key] = Date.now();
    // don dep: chi giu toi da 100 khoa gan nhat
    const entries = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 100);
    localStorage.setItem(LS_KEY, JSON.stringify(Object.fromEntries(entries)));
    return false;
  } catch {
    return false;
  }
}

/**
 * Gọi sau khi một tín hiệu mới được sinh. Fire-and-forget: mọi lỗi đều nuốt
 * im lặng để không ảnh hưởng luồng tính tín hiệu của cockpit.
 */
export function maybeRelaySignal(signal: Signal): void {
  try {
    if (!RELAY_KEY) return; // chua cau hinh khoa -> tat relay
    if (!signal || signal.direction === 'FLAT') return;
    const pct = scorePct(signal);
    if (pct < MIN_SCORE_PCT) return;
    const dedupeKey = `${signal.symbol}|${signal.direction}|${signal.engine}`;
    if (alreadySent(dedupeKey)) return;

    const payload = {
      symbol: signal.symbol,
      direction: signal.direction,
      timeframe: signal.timeframe,
      engine: signal.engine,
      engine_name: signal.engineName,
      entry_price: signal.entryPrice,
      stop_loss: signal.stopLoss,
      tp1: signal.tp1,
      tp2: signal.tp2,
      tp3: signal.tp3,
      score: pct,
      quality: signal.quality,
      suggested_lot: signal.suggestedLot,
      rationale: signal.rationale,
      source: 'cockpit-relay',
    };

    void fetch(RELAY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signal-Key': RELAY_KEY,
      },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* relay khong bao gio duoc lam hong cockpit */
  }
}
