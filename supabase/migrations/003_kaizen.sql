-- 003_kaizen.sql — Kho FINDING Kaizen + KHO KIẾN THỨC (vòng Kaizen khép kín, Phase A)
-- Chạy trong Supabase SQL Editor (1 lần). API dùng service_role (bypass RLS).

create table if not exists kaizen_findings (
  id text primary key,
  area text not null,                       -- 'phien' | 'benchmark' | 'factor' | 'verdict' | 'drawdown' | 'symbol'
  metric text not null,                     -- 'win-rate' | 'avg-r' | 'profit-factor' | 'max-dd' ...
  title text not null,
  evidence text not null,                   -- bằng chứng số
  hypothesis text not null,                 -- giả thuyết nguyên nhân
  action text not null,                     -- hành động đề xuất
  severity text not null check (severity in ('cao', 'trung-binh', 'thap')),
  kind text not null check (kind in ('luat-cung', 'de-xuat')),
  status text not null default 'moi'
    check (status in ('moi', 'dang-theo-doi', 'da-kiem-chung', 'da-bac-bo')),
  sample_size integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_kf_status on kaizen_findings(status);
create index if not exists idx_kf_created on kaizen_findings(created_at desc);

create table if not exists knowledge_entries (
  id text primary key,
  rule text not null,                       -- luật
  conditions jsonb not null default '[]',   -- [{field, op, value}] — rỗng = mọi trường hợp
  confidence text not null check (confidence in ('cao', 'trung-binh', 'thap')),
  sample_size integer not null default 0,
  label text not null check (label in ('FACT', 'TINH_TOAN', 'SUY_LUAN', 'CHUA_XAC_MINH')),
  source text not null default '',          -- id finding hoặc 'thu-cong'
  active boolean not null default true,     -- false = hết hiệu lực (giữ lịch sử)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_kn_active on knowledge_entries(active);
