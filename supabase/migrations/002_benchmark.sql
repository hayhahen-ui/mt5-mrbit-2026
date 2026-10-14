-- 002_benchmark.sql — Kho strategy tham chiếu cho tính năng ĐỐI ỨNG BENCHMARK
-- Chạy trong Supabase SQL Editor (1 lần). Dùng service_role key ở phía API (bypass RLS).
--
-- Luồng auto: user dán link Vantage trong chat → assistant fetch lịch sử lệnh
-- (đăng nhập Vantage đã lưu) → POST vào API → app đọc từ server, đa thiết bị.

create table if not exists benchmark_strategies (
  id text primary key,
  name text not null,
  source text not null default 'manual', -- 'vantage-copy' | 'manual' | 'other'
  source_note text,
  source_url text,
  created_at timestamptz not null default now()
);

create table if not exists benchmark_trades (
  id text primary key,
  strategy_id text not null references benchmark_strategies(id) on delete cascade,
  symbol text not null,
  direction text not null check (direction in ('BUY', 'SELL')),
  open_time timestamptz,
  close_time timestamptz not null default now(),
  open_price numeric not null default 0,
  close_price numeric not null default 0,
  lot numeric not null default 0,
  pnl_usd numeric not null,
  risk_usd numeric,
  r_multiple numeric not null default 0,
  r_known boolean not null default false,
  pips numeric not null default 0,
  note text
);
create index if not exists idx_bm_trades_strategy on benchmark_trades(strategy_id);
create index if not exists idx_bm_trades_close on benchmark_trades(strategy_id, close_time desc);
