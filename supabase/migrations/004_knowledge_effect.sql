-- 004_knowledge_effect.sql — Thêm cột effect cho kho kiến thức (Phase C: cổng RADAR)
-- 'block' = chặn tín hiệu, 'warn' = cảnh báo, 'research' = chỉ theo dõi (mặc định, an toàn).
-- Chạy trong Supabase SQL Editor (1 lần).

alter table knowledge_entries
  add column if not exists effect text not null default 'research'
  check (effect in ('block', 'warn', 'research'));
