import React, { useState, useEffect } from 'react';
import { Share2, Users, Copy, Check, RefreshCw, Smartphone, Plus } from 'lucide-react';
import {
  getGroupId, setGroupId, createGroup, shareLink,
  getDeviceId, getDeviceName, setDeviceName,
  pullShared, SharedEntry,
} from '../lib/groupSync';

/**
 * SharedPanel — Chia sẻ & xem journal đa thiết bị.
 * - Chủ: tạo nhóm → copy link gửi → xem giao dịch mọi thiết bị.
 * - Khách (mở link ?g=): tự join, giao dịch tự đẩy lên kho chung.
 */
export const SharedPanel: React.FC = () => {
  const [group, setGroup] = useState<string | null>(getGroupId());
  const [deviceName, setDName] = useState(getDeviceName() || getDeviceId());
  const [copied, setCopied] = useState(false);
  const [entries, setEntries] = useState<SharedEntry[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = async (g?: string | null) => {
    const gid = (g || group || '').toUpperCase();
    if (!gid) return;
    setLoading(true);
    setErr('');
    try {
      const d = await pullShared(gid);
      setEntries(d.entries.sort((a: SharedEntry, b: SharedEntry) => b.ts - a.ts));
      setDevices(d.devices);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Lỗi tải.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (group) load(group); }, []);

  const handleCreate = () => {
    const g = createGroup();
    setGroup(g);
    load(g);
  };

  const handleCopy = async () => {
    if (!group) return;
    try {
      await navigator.clipboard.writeText(shareLink(group));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  };

  const handleLeave = () => {
    setGroupId(null);
    setGroup(null);
    setEntries([]);
    setDevices([]);
  };

  const saveName = () => setDeviceName(deviceName.trim() || getDeviceId());

  const totalPnl = entries.reduce((s, e) => s + (e.pnl || 0), 0);

  return (
    <div className="glass-panel p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Share2 size={18} className="text-emerald-400" />
        <div>
          <div className="font-bold text-sm text-slate-100">JOURNAL CHIA SẺ ĐA THIẾT BỊ</div>
          <div className="text-[11px] text-slate-400">Gửi link cho máy khác — giao dịch trên đó tự lưu vào kho chung, bạn xem được ở đây.</div>
        </div>
      </div>

      {/* Tên thiết bị */}
      <div className="flex flex-wrap items-center gap-2">
        <Smartphone size={14} className="text-slate-400" />
        <span className="text-xs text-slate-300">Tên thiết bị này:</span>
        <input value={deviceName} onChange={(e) => setDName(e.target.value)} onBlur={saveName}
          placeholder="VD: Điện thoại, Laptop công ty…"
          className="bg-[#0b0f19] border border-[#1e2b48] rounded-lg px-2.5 py-1.5 text-xs text-slate-200 w-52 focus:outline-none focus:border-emerald-500" />
        <span className="text-[10px] text-slate-500 font-mono">id: {getDeviceId()}</span>
      </div>

      {!group ? (
        <div className="flex items-center gap-2">
          <button onClick={handleCreate}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600/30 border border-emerald-500/50 text-emerald-200 hover:bg-emerald-600/50">
            <Plus size={14} /> Tạo nhóm chia sẻ mới
          </button>
          <span className="text-[11px] text-slate-500">hoặc mở link ?g= được gửi để tự join</span>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-[#0d1526] border border-[#1e2b48]">
            <span className="text-xs text-slate-400">Nhóm:</span>
            <span className="font-mono font-bold text-emerald-300">{group}</span>
            <button onClick={handleCopy}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#17223b] border border-[#243356] text-slate-300 hover:text-white">
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              {copied ? 'Đã copy!' : 'Copy link chia sẻ'}
            </button>
            <button onClick={() => load()} disabled={loading}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] text-slate-400 hover:text-white">
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Tải lại
            </button>
            <button onClick={handleLeave} className="text-[11px] text-rose-400 hover:text-rose-300 ml-auto">Rời nhóm</button>
          </div>

          {err && <div className="text-[11px] text-rose-300 bg-rose-950/40 border border-rose-800 rounded-lg p-2">{err}</div>}

          {/* Thiết bị */}
          {devices.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Users size={13} className="text-slate-400" />
              {devices.map((d) => (
                <span key={d.deviceId} className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#17223b] border border-[#243356] text-slate-300"
                  title={`${d.count} giao dịch · cuối: ${new Date(d.lastAt).toLocaleString('vi-VN')}`}>
                  📱 {d.deviceName} ({d.count})
                </span>
              ))}
            </div>
          )}

          {/* Bảng giao dịch */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[#1e2b48] text-slate-400 font-mono">
                  <th className="py-2">Thời gian</th><th>Thiết bị</th><th>Loại</th><th>Mã</th>
                  <th>Hướng</th><th>Giá vào/ra</th><th>Lot</th><th>P&L</th><th>Kết quả</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2b48] font-mono">
                {entries.length === 0 && (
                  <tr><td colSpan={9} className="py-6 text-center text-slate-500">
                    {loading ? 'Đang tải…' : 'Chưa có giao dịch nào trong nhóm.'}
                  </td></tr>
                )}
                {entries.slice(0, 50).map((e, i) => (
                  <tr key={i} className="hover:bg-[#17223b]/40">
                    <td className="py-2 text-slate-400">{new Date(e.ts).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="text-sky-300">{e.deviceName}</td>
                    <td>{e.type === 'position_open'
                      ? <span className="px-1.5 py-0.5 rounded bg-sky-900/60 border border-sky-700 text-sky-300 text-[10px] font-bold">MỞ</span>
                      : <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 text-[10px]">ĐÓNG</span>}</td>
                    <td className="font-bold text-slate-200">#{e.symbol}</td>
                    <td className={e.direction === 'BUY' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{e.direction}</td>
                    <td className="text-slate-400">{e.entry ?? '—'} → {e.exit ?? '—'}</td>
                    <td className="text-slate-400">{e.lot ?? '—'}</td>
                    <td className={`font-bold ${(e.pnl || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {e.pnl !== null && e.pnl !== undefined ? `${e.pnl >= 0 ? '+' : ''}${e.pnl.toFixed(2)}` : '—'}
                    </td>
                    <td className="text-slate-400">{e.outcome || e.rMultiple !== null ? `${e.rMultiple}R` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {entries.length > 0 && (
            <div className="text-xs text-slate-400 font-mono">
              Tổng {entries.length} giao dịch · P&L: <strong className={totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}</strong>
            </div>
          )}
        </>
      )}
      <div className="text-[10px] text-slate-500 italic">
        Dữ liệu lưu trên kho online (nhánh data GitHub) — giữ vài năm. Thiết bị khách không cần key GitHub.
      </div>
    </div>
  );
};
