/**
 * time.ts — Định dạng thời gian theo GIỜ MÁY (múi giờ local của người dùng).
 * Dữ liệu lưu ở dạng ISO (UTC); mọi chỗ hiển thị cho người dùng đều phải qua đây.
 */

const p2 = (n: number) => String(n).padStart(2, '0');

/** "2026-10-10 11:59" theo giờ máy */
export function fmtLocalTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/** "11:59:32" theo giờ máy */
export function fmtLocalClock(iso: string | number): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}
