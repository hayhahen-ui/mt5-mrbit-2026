import React, { useEffect, useMemo, useState } from 'react';
import { Scale, Plus, Trash2, Upload, Link2, Cloud, HardDrive } from 'lucide-react';
import { JournalStats } from '../types';
import {
  BenchmarkSource,
  BenchmarkStrategy,
  BENCHMARK_SOURCE_LABEL,
  MAX_TRADES_PER_STRATEGY,
  benchmarkEquityCurveR,
  benchmarkServerOn,
  calcBenchmarkStats,
  createBenchmarkServer,
  createStrategy,
  deleteBenchmarkServer,
  fetchBenchmarksServer,
  filterTradesByCutoff,
  loadBenchmarks,
  maxDrawdown,
  parseBenchmarkCsv,
  parseVantageLink,
  pushBenchmarkTradesServer,
  saveBenchmarks,
} from '../lib/benchmark';
import { fmtUsd } from '../lib/account';

interface BenchmarkPanelProps {
  systemStats: JournalStats;
  systemCurve: { x: number; y: number }[];
  systemUsd: number;
  cutoff: number;
  range: string;
}

const CSV_HINT = `symbol,direction,openTime,closeTime,openPrice,closePrice,lot,pnlUsd,riskUsd,pips,note
XAUUSD,BUY,2026-10-01T08:00:00Z,2026-10-01T12:00:00Z,4190.5,4210.2,0.01,19.70,10,197,
EURUSD,SELL,2026-10-02T09:00:00Z,2026-10-02T15:00:00Z,1.0860,1.0820,0.02,8.00,,40,`;

function MetricRow({ label, sys, bm, better }: { label: string; sys: string; bm: string; better?: 'sys' | 'bm' | null }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[#1e2b48]/50 last:border-0 font-mono text-xs">
      <span className="text-slate-400 w-32 shrink-0">{label}</span>
      <span className={`flex-1 text-right font-bold ${better === 'sys' ? 'text-emerald-300' : 'text-slate-200'}`}>{sys}</span>
      <span className={`flex-1 text-right font-bold ${better === 'bm' ? 'text-sky-300' : 'text-slate-200'}`}>{bm}</span>
    </div>
  );
}

export const BenchmarkPanel: React.FC<BenchmarkPanelProps> = ({ systemStats, systemCurve, systemUsd, cutoff, range }) => {
  const [strategies, setStrategies] = useState<BenchmarkStrategy[]>(() => loadBenchmarks());
  const [selectedId, setSelectedId] = useState<string | null>(() => loadBenchmarks()[0]?.id ?? null);
  const [fromServer, setFromServer] = useState(false);
  const [loading, setLoading] = useState(benchmarkServerOn());
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSource, setNewSource] = useState<BenchmarkSource>('vantage-copy');
  const [newNote, setNewNote] = useState('');
  const [link, setLink] = useState('');
  const [linkMsg, setLinkMsg] = useState('');
  const [csv, setCsv] = useState('');
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [csvInfo, setCsvInfo] = useState('');

  // Ưu tiên đọc server (đa thiết bị); rớt → dùng cache localStorage
  useEffect(() => {
    let alive = true;
    (async () => {
      const remote = await fetchBenchmarksServer();
      if (!alive) return;
      if (remote) {
        setStrategies(remote);
        saveBenchmarks(remote);
        setFromServer(true);
        setSelectedId((cur) => (remote.find((s) => s.id === cur) ? cur : remote[0]?.id ?? null));
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const cacheLocal = (list: BenchmarkStrategy[]) => {
    setStrategies(list);
    saveBenchmarks(list);
    if (selectedId && !list.find((s) => s.id === selectedId)) {
      setSelectedId(list[0]?.id ?? null);
    }
  };

  const selected = strategies.find((s) => s.id === selectedId) ?? null;
  const bmTrades = useMemo(() => (selected ? filterTradesByCutoff(selected.trades, cutoff) : []), [selected, cutoff]);
  const bm = useMemo(() => calcBenchmarkStats(bmTrades), [bmTrades]);
  const bmCurve = useMemo(() => benchmarkEquityCurveR(bmTrades), [bmTrades]);

  const addStrategy = async (input: { name: string; source: BenchmarkSource; sourceNote?: string; sourceUrl?: string }) => {
    const remote = await createBenchmarkServer(input);
    const st: BenchmarkStrategy = remote ?? createStrategy(input.name, input.source, input.sourceNote);
    if (remote && input.sourceUrl) st.sourceUrl = input.sourceUrl;
    const list = [...strategies, st];
    cacheLocal(list);
    setSelectedId(st.id);
    return st;
  };

  const handleAdd = async () => {
    await addStrategy({ name: newName || `Benchmark ${strategies.length + 1}`, source: newSource, sourceNote: newNote });
    setNewName(''); setNewNote(''); setShowAdd(false);
  };

  /** Dán link Vantage → tự tạo strategy (auto-flow: chat cũng dùng cùng logic) */
  const handleLink = async () => {
    setLinkMsg('');
    const parsed = parseVantageLink(link);
    if (!parsed) {
      setLinkMsg('Link không chứa strategyId — kiểm tra lại đường dẫn Vantage.');
      return;
    }
    if (strategies.some((s) => s.sourceUrl === link.trim() || s.name === `Vantage #${parsed.strategyId}`)) {
      setLinkMsg(`Strategy Vantage #${parsed.strategyId} đã có trong danh sách.`);
      return;
    }
    const st = await addStrategy({
      name: `Vantage #${parsed.strategyId}`,
      source: 'vantage-copy',
      sourceUrl: link.trim(),
      sourceNote: 'Tạo tự động từ link — dữ liệu lệnh sẽ được assistant nhập sau khi fetch.',
    });
    setLink('');
    setLinkMsg(`Đã tạo "${st.name}" — dán link trong chat để assistant tự fetch lệnh.`);
  };

  const handleDelete = async (id: string) => {
    const st = strategies.find((s) => s.id === id);
    if (!st) return;
    if (!window.confirm(`Xóa strategy tham chiếu "${st.name}" và toàn bộ ${st.trades.length} lệnh?`)) return;
    await deleteBenchmarkServer(id);
    cacheLocal(strategies.filter((s) => s.id !== id));
  };

  const handleImport = async () => {
    setCsvErrors([]); setCsvInfo('');
    if (!selected) return;
    const { trades, errors } = parseBenchmarkCsv(csv);
    if (selected.trades.length + trades.length > MAX_TRADES_PER_STRATEGY) {
      setCsvErrors([`Vượt trần ${MAX_TRADES_PER_STRATEGY} lệnh/strategy — đã giữ nguyên dữ liệu cũ, không nhập thêm.`]);
      return;
    }
    if (trades.length === 0 && errors.length === 0) {
      setCsvErrors(['Không có dòng hợp lệ để nhập.']);
      return;
    }
    const pushed = await pushBenchmarkTradesServer(selected.id, trades);
    const updated: BenchmarkStrategy = { ...selected, trades: [...selected.trades, ...trades] };
    void pushed;
    cacheLocal(strategies.map((s) => (s.id === selected.id ? updated : s)));
    setCsvErrors(errors);
    setCsvInfo(`Đã nhập ${trades.length} lệnh vào "${selected.name}"${errors.length ? ` (${errors.length} dòng lỗi)` : ''}${fromServer ? ' · đã đồng bộ server' : ''}.`);
    setCsv('');
  };

  const fmtR = (v: number, has: boolean) => (has ? `${v >= 0 ? '+' : ''}${v}R` : '—');
  const num = (a: number, b: number) => {
    if (a === b) return null;
    return a > b ? 'sys' as const : 'bm' as const;
  };

  const overlayMaxY = Math.max(1, ...systemCurve.map((p) => Math.abs(p.y)), ...bmCurve.map((p) => Math.abs(p.y)));
  const toPoints = (curve: { x: number; y: number }[]) =>
    curve.map((p, i) => {
      const x = curve.length === 1 ? 300 : 10 + (i / (curve.length - 1)) * 580;
      const y = 75 - (p.y / overlayMaxY) * 60;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

  const dWin = Number((bm.winRate - systemStats.winRate).toFixed(1));
  const dR = bm.hasR ? Number((bm.avgR - systemStats.avgR).toFixed(2)) : null;
  const sysMaxDdR = maxDrawdown(systemCurve.map((p) => p.y));
  const fmtSignedUsd = (v: number) => `${v >= 0 ? '+' : '-'}${fmtUsd(Math.abs(v))}`;

  return (
    <div className="glass-panel p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
          <Scale size={16} className="text-amber-400" />
          ĐỐI ỨNG BENCHMARK — SO VỚI STRATEGY THAM CHIẾU
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${fromServer ? 'text-emerald-400 border-emerald-800/60' : 'text-slate-500 border-[#1e2b48]'}`}>
            {loading ? '…' : fromServer ? (<span className="inline-flex items-center gap-1"><Cloud size={10} /> SERVER</span>) : (<span className="inline-flex items-center gap-1"><HardDrive size={10} /> LOCAL</span>)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {strategies.length > 0 && (
            <select
              value={selectedId ?? ''}
              onChange={(e) => setSelectedId(e.target.value)}
              className="bg-[#0b0f19] border border-[#1e2b48] rounded-lg text-xs font-mono text-slate-200 px-2 py-1.5"
            >
              {strategies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.trades.length} lệnh)
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="py-1.5 px-3 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center gap-1.5"
          >
            <Plus size={13} /> Thêm strategy
          </button>
        </div>
      </div>

      {/* Dán link Vantage → auto tạo strategy */}
      <div className="bg-[#0b0f19] border border-[#1e2b48] rounded-xl p-3.5 space-y-2">
        <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
          <Link2 size={13} className="text-sky-400" />
          DÁN LINK VANTAGE — TỰ TẠO STRATEGY
        </div>
        <div className="flex gap-2">
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://secure.vantagemarkets.com/copyTrading/visitor/discover/discoverDetail?strategyId=..."
            spellCheck={false}
            className="flex-1 bg-[#080c14] border border-[#1e2b48] rounded-lg px-3 py-2 text-[11px] font-mono text-slate-200 placeholder:text-slate-600"
          />
          <button
            onClick={handleLink}
            disabled={!link.trim()}
            className="py-2 px-4 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 font-bold text-xs whitespace-nowrap"
          >
            TẠO TỪ LINK
          </button>
        </div>
        {linkMsg && <div className="text-[11px] font-mono text-slate-400">{linkMsg}</div>}
        <div className="text-[10px] text-slate-500 font-mono">
          App tách strategyId từ link và tạo strategy ngay. Dữ liệu lệnh: dán trong chat để assistant tự fetch (đã lưu đăng nhập Vantage) rồi đẩy lên server.
        </div>
      </div>

      {showAdd && (
        <div className="bg-[#0b0f19] border border-[#1e2b48] rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Tên strategy — vd Vantage #1533098"
              className="bg-[#080c14] border border-[#1e2b48] rounded-lg px-3 py-2 text-xs font-mono text-slate-200"
            />
            <select
              value={newSource}
              onChange={(e) => setNewSource(e.target.value as BenchmarkSource)}
              className="bg-[#080c14] border border-[#1e2b48] rounded-lg px-3 py-2 text-xs font-mono text-slate-200"
            >
              {(Object.keys(BENCHMARK_SOURCE_LABEL) as BenchmarkSource[]).map((k) => (
                <option key={k} value={k}>{BENCHMARK_SOURCE_LABEL[k]}</option>
              ))}
            </select>
            <input
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Ghi chú nguồn (tùy chọn)"
              className="bg-[#080c14] border border-[#1e2b48] rounded-lg px-3 py-2 text-xs font-mono text-slate-200"
            />
          </div>
          <button onClick={handleAdd} className="py-2 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs">
            TẠO STRATEGY
          </button>
        </div>
      )}

      {strategies.length === 0 && !showAdd ? (
        <div className="text-xs text-slate-500 bg-[#0b0f19] p-4 rounded-lg border border-[#1e2b48] text-center">
          Chưa có strategy tham chiếu nào. Dán link Vantage ở trên hoặc bấm "Thêm strategy" —
          rồi nhập lịch sử lệnh (CSV) để so sánh với hệ thống.
        </div>
      ) : selected ? (
        <>
          <div className="text-[10px] text-slate-500 font-mono">
            Nguồn: {BENCHMARK_SOURCE_LABEL[selected.source]}
            {selected.sourceNote ? ` · ${selected.sourceNote}` : ''} · Khoảng so sánh: {range}
          </div>

          <div className="bg-[#0b0f19] rounded-xl border border-[#1e2b48] p-4">
            <div className="flex items-center justify-between py-1.5 border-b border-[#1e2b48] font-mono text-[11px] font-bold">
              <span className="text-slate-500 w-32">CHỈ SỐ</span>
              <span className="flex-1 text-right text-emerald-400">HỆ THỐNG</span>
              <span className="flex-1 text-right text-sky-400">{selected.name.toUpperCase().slice(0, 24)}</span>
            </div>
            <MetricRow label="Số lệnh" sys={String(systemStats.total)} bm={String(bm.total)} better={num(systemStats.total, bm.total)} />
            <MetricRow label="Win rate" sys={`${systemStats.winRate}%`} bm={`${bm.winRate}%`} better={num(systemStats.winRate, bm.winRate)} />
            <MetricRow label="Avg R" sys={fmtR(systemStats.avgR, true)} bm={fmtR(bm.avgR, bm.hasR)} better={bm.hasR ? num(systemStats.avgR, bm.avgR) : null} />
            <MetricRow label="Profit Factor" sys={String(systemStats.profitFactor)} bm={bm.hasR ? String(bm.profitFactor) : '—'} better={bm.hasR ? num(systemStats.profitFactor, bm.profitFactor) : null} />
            <MetricRow label="Tổng R" sys={fmtR(systemStats.totalR, true)} bm={fmtR(bm.totalR, bm.hasR)} better={bm.hasR ? num(systemStats.totalR, bm.totalR) : null} />
            <MetricRow label="Tổng $" sys={fmtSignedUsd(systemUsd)} bm={fmtSignedUsd(bm.totalUsd)} better={num(systemUsd, bm.totalUsd)} />
            <MetricRow label="Max DD (R)" sys={`${sysMaxDdR}R`} bm={bm.hasR ? `${bm.maxDrawdownR}R` : '—'} better={bm.hasR ? (sysMaxDdR === bm.maxDrawdownR ? null : sysMaxDdR < bm.maxDrawdownR ? 'sys' : 'bm') : null} />
            <MetricRow label="Max DD ($)" sys="—" bm={`${fmtUsd(bm.maxDrawdownUsd)}`} />
          </div>

          {bm.total > 0 && (
            <div className="text-xs font-mono text-slate-300 bg-[#0b0f19] border border-[#1e2b48] rounded-lg p-3">
              <span className="text-purple-400 font-bold">KAIZEN GỢI Ý: </span>
              Benchmark {dWin >= 0 ? 'hơn' : 'kém'} hệ thống {Math.abs(dWin)}% win rate
              {dR !== null && <>{' · '}avg R {dR >= 0 ? '+' : ''}{dR}R</>}
              {' · '}tổng {bm.totalUsd >= 0 ? '+' : '-'}${fmtUsd(Math.abs(bm.totalUsd))} trên {bm.total} lệnh.
              {!bm.hasR && ' (Benchmark chưa có dữ liệu R — cần cột riskUsd khi nhập để so sánh R.)'}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-4 text-[11px] font-mono">
              <span className="font-bold text-slate-300">ĐƯỜNG CONG R — OVERLAY</span>
              <span className="text-emerald-400">— Hệ thống</span>
              <span className="text-sky-400">— {selected.name.slice(0, 20)}</span>
            </div>
            <div className="w-full h-48 bg-[#080c14] rounded-lg border border-[#1e2b48] p-2">
              {!bm.hasR ? (
                <div className="w-full h-full flex items-center justify-center text-xs text-slate-500 text-center px-4">
                  Benchmark chưa có dữ liệu R (thiếu riskUsd/SL từng lệnh) — hãy nhập lại CSV có cột riskUsd để vẽ overlay.
                </div>
              ) : systemCurve.length === 0 && bmCurve.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
                  Chưa có dữ liệu đường cong.
                </div>
              ) : (
                <svg className="w-full h-full" viewBox="0 0 600 150" preserveAspectRatio="none">
                  <line x1="0" y1="75" x2="600" y2="75" stroke="#162238" strokeDasharray="4" />
                  {bmCurve.length > 0 && (
                    <polyline points={toPoints(bmCurve)} fill="none" stroke="#38bdf8" strokeWidth="2.5" />
                  )}
                  {systemCurve.length > 0 && (
                    <polyline points={toPoints(systemCurve)} fill="none" stroke="#10b981" strokeWidth="2.5" />
                  )}
                </svg>
              )}
            </div>
          </div>

          <div className="bg-[#0b0f19] rounded-xl border border-[#1e2b48] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-300">NHẬP LỊCH SỬ LỆNH (CSV)</div>
              <span className="text-[10px] font-mono text-slate-500">{selected.trades.length} lệnh đã lưu · trần {MAX_TRADES_PER_STRATEGY}</span>
            </div>
            <textarea
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder={CSV_HINT}
              rows={5}
              spellCheck={false}
              className="w-full bg-[#080c14] border border-[#1e2b48] rounded-lg p-3 text-[11px] font-mono text-slate-200 placeholder:text-slate-600"
            />
            <div className="text-[10px] text-slate-500 font-mono">
              Bắt buộc: symbol, direction (BUY/SELL), pnlUsd (số, có dấu). Tùy chọn: openTime, closeTime (ISO), openPrice, closePrice, lot, riskUsd (để tính R), pips, note.
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleImport}
                disabled={!csv.trim()}
                className="py-2 px-4 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center gap-2"
              >
                <Upload size={13} /> NHẬP LỆNH
              </button>
              <button
                onClick={() => handleDelete(selected.id)}
                className="py-2 px-3 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/40 font-bold text-xs flex items-center gap-1.5"
              >
                <Trash2 size={13} /> Xóa strategy
              </button>
            </div>
            {csvInfo && <div className="text-xs font-mono text-emerald-400">{csvInfo}</div>}
            {csvErrors.length > 0 && (
              <div className="text-xs font-mono text-rose-400 space-y-0.5">
                {csvErrors.slice(0, 10).map((e, i) => <div key={i}>{e}</div>)}
                {csvErrors.length > 10 && <div>…và {csvErrors.length - 10} lỗi khác</div>}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
};
