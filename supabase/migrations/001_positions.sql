-- 001_positions.sql — Kho vị thế server-side cho nấc 2 (Naive auto-operation)
-- Chạy trong Supabase SQL Editor. Dùng service_role key ở phía API (bypass RLS).

create table if not exists positions (
  id text primary key,
  symbol text not null,
  type text not null check (type in ('BUY', 'SELL')),
  lot numeric not null check (lot >= 0.01),
  entry_price numeric not null,
  sl numeric not null,
  tp numeric not null,
  tier text not null default 'SINGLE',
  status text not null default 'open' check (status in ('open', 'closed')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  exit_price numeric,
  outcome text,
  close_note text,
  auto_close jsonb not null default '{}',
  device_id text,
  kaizen_id text,
  signal_score numeric,
  created_by text not null default 'browser' -- 'browser' | 'agent'
);
create index if not exists idx_positions_status on positions(status);
create index if not exists idx_positions_symbol_status on positions(symbol, status);

-- Audit log mọi hành động của agent (và browser qua API)
create table if not exists agent_actions (
  id bigserial primary key,
  ts timestamptz not null default now(),
  agent text not null,              -- 'browser' | agent name trên Naive
  action text not null,             -- open | close | update | halt | brief
  position_id text,
  params jsonb,
  result text
);
create index if not exists idx_agent_actions_ts on agent_actions(ts desc);

-- Trạng thái tài khoản do trình duyệt đẩy lên định kỳ (equity/balance/P&L)
-- Agent đọc qua /api/agent-brief. updated_at quá 30' = stale → API từ chối mở lệnh agent.
create table if not exists account_state (
  id int primary key default 1,
  start_balance numeric not null default 200,
  realized_pnl numeric not null default 0,
  equity numeric not null default 200,
  floating_pnl numeric not null default 0,
  open_count int not null default 0,
  used_margin numeric not null default 0,
  updated_at timestamptz not null default now(),
  constraint one_row check (id = 1)
);

-- Cờ điều khiển: risk-manager đặt halt để khóa mở lệnh agent
create table if not exists flags (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
