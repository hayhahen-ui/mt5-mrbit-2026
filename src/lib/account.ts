/**
 * account.ts — Tài khoản VỐN ẢO (paper trading).
 * - Người dùng chọn vốn ban đầu (preset 1K/10K/50K/100K hoặc nhập tay).
 * - Balance = vốn ban đầu + P&L đã thực hiện (tính từ sổ).
 * - Equity = Balance + P&L thả nổi của lệnh đang mở.
 */
import { JournalEntry } from '../types';

const KEY = 'nexuspilot-account-v1';

export const CAPITAL_PRESETS = [1000, 10000, 50000, 100000];
export const DEFAULT_CAPITAL = 100000;

const FOREX = new Set(['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'NZDUSD', 'USDCAD', 'USDCHF', 'EURJPY', 'GBPJPY', 'EURGBP']);

export function isForexSymbol(symbol: string): boolean {
  return FOREX.has(symbol);
}

/** $/pip cho 1 lot — khớp công thức floating pnl trong App */
/** $/pip cho 1 lot — khớp công thức floating pnl trong App */
export function usdPerPipPerLot(symbol: string, price?: number): number {
  if (symbol.includes('JPY')) return price && price > 0 ? 1000 / price : 6.3; // ~1000/158
  if (isForexSymbol(symbol)) return 10;
  return 0.1; // crypto/metals: 1 pip (0.1 giá) = $0.10/lot; XAUUSD riêng tính theo oz
}

/** XAUUSD đặc biệt: 1 lot = 100 oz → $/pip = $10 (pip 0.1 = $1/oz × 100) */
export function pipSizeOf(symbol: string): number {
  if (symbol.includes('JPY')) return 0.01;
  return isForexSymbol(symbol) ? 0.0001 : 0.1;
}

/** P&L $ của một bản ghi sổ — tính lại từ giá để khớp công thức floating */
export function entryPnlUsd(e: JournalEntry): number {
  const diff = e.direction === 'BUY' ? e.exitPrice - e.entryPrice : e.entryPrice - e.exitPrice;
  const pips = diff / pipSizeOf(e.symbol);
  // XAUUSD: P&L = diff($/oz) × 100 oz × lot
  if (e.symbol === 'XAUUSD') return Number((diff * 100 * e.lot).toFixed(2));
  return Number((pips * e.lot * usdPerPipPerLot(e.symbol, e.exitPrice)).toFixed(2));
}

/** Tổng P&L đã thực hiện từ sổ */
export function realizedPnlUsd(entries: JournalEntry[]): number {
  return Number(entries.reduce((a, e) => a + entryPnlUsd(e), 0).toFixed(2));
}

export function loadStartBalance(): number {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_CAPITAL;
    const v = Number(JSON.parse(raw)?.startBalance);
    return v > 0 && v <= 100_000_000 ? v : DEFAULT_CAPITAL;
  } catch {
    return DEFAULT_CAPITAL;
  }
}

export function saveStartBalance(v: number): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ startBalance: v }));
  } catch {
    /* bỏ qua */
  }
}

export function fmtUsd(v: number): string {
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
