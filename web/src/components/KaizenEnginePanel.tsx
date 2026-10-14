/**
 * KaizenEnginePanel — Tầng 3+4 vòng Kaizen khép kín (Phase A).
 * Sinh FINDING từ dữ liệu thật (journal + benchmark) → duyệt → Kho kiến thức.
 * Server trước (badge SERVER), fallback local.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { BrainCircuit, FlaskConical, CheckCircle2, Eye, XCircle, BookOpen, Plus } from 'lucide-react';
import { generateFindings, KaizenFinding } from '../lib/kaizenEngine';
import {
  KnowledgeEntry, loadKnowledge, addKnowledge, deactivateKnowledge, reactivateKnowledge, promoteFinding,
} from '../lib/knowledge';
import { calcJournalStats, equityCurve } from '../lib/journal';
import { KaizenAnalysis, JournalEntry } from '../types';
import {
  BenchmarkStrategy, BenchmarkStats, calcBenchmarkStats, loadBenchmarks,
  fetchBenchmarksServer, benchmarkServerOn, maxDrawdown,
} from '../lib/benchmark';
import {
  postFindingServer, patchFindingServer, fetchKnowledgeServer,
  postKnowledgeServer, patchKnowledgeServer,
} from '../lib/kaizenServer';

const FIND_KEY = 'nexuspilot-kaizen-findings-v1';
const loadLocalFindings = (): KaizenFinding[] => {
  try {
    const raw = localStorage.getItem(FIND_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
};
const saveLocalFindings = (l: KaizenFinding[]) => {
  try { localStorage.setItem(FIND_KEY, JSON.stringify(l.slice(-200))); } catch { /* giữ cũ */ }
};

const SEV_STYLE: Record<string, string> = {
  'cao': 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  'trung-binh': 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  'thap': 'bg-slate-500/15 text-slate-300 border-slate-500/30',
};
const STATUS_LABEL: Record<string, string> = {
  'moi': 'MỚI', 'dang-theo-doi': 'THEO DÕI', 'da-kiem-chung': 'ĐÃ KIỂM CHỨNG', 'da-bac-bo': 'ĐÃ BÁC BỎ',
};

interface Props { journal: JournalEntry[]; kaizen: KaizenAnalysis; }

export const KaizenEnginePanel: React.FC<Props> = ({ journal, kaizen }) => {
  const [strategies, setStrategies] = useState<BenchmarkStrategy[]>(() => loadBenchmarks());
  const [server, setServer] = useState(benchmarkServerOn());
  const [findings, setFindings] = useState<KaizenFinding[]>(() => loadLocalFindings());
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>(() => loadKnowledge());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchBenchmarksServer().then((remote) => {
      if (remote) { setStrategies(remote); setServer(true); }
    }).catch(() => {});
    fetchKnowledgeServer().then((remote) => { if (remote) setKnowledge(remote); }).catch(() => {});
  }, []);

  const input = useMemo(() => {
    const fs = calcJournalStats(journal);
    const curve = equityCurve(journal);
    const bySymbol: Record<string, BenchmarkStats> = {};
    for (const s of [...new Set(journal.map((j) => j.symbol))]) {
      const ej = journal.filter((j) => j.symbol === s);
      const st = calcJournalStats(ej);
      const c = equityCurve(ej).map((p) => p.y);
      bySymbol[s] = { ...st, totalPips: st.totalPips, totalUsd: 0, maxDrawdownR: maxDrawdown(c), maxDrawdownUsd: 0, hasR: true } as BenchmarkStats;
    }
    return {
      system: {
        stats: {
          total: fs.total, winRate: fs.winRate, avgR: fs.avgR, profitFactor: fs.profitFactor,
          maxDrawdownR: maxDrawdown(curve.map((p) => p.y)), hasR: true,
        },
        bySession: kaizen.bySession,
        factors: kaizen.factors,
        verdicts: kaizen.byVerdict.map((v) => ({ verdict: String(v.verdict), closed: v.closed, winRate: v.winRate, avgR: v.avgR })),
        bySymbol,
      },
      benchmarks: strategies.map((s) => ({ name: s.name, stats: calcBenchmarkStats(s.trades || []) })),
    };
  }, [journal, kaizen, strategies]);

  const canRun = input.system.stats.total >= 10 || input.benchmarks.some((b) => b.stats.total >= 20);

  const runEngine = async () => {
    setBusy(true);
    try {
      const fresh = generateFindings(input as any);
      const saved: KaizenFinding[] = [];
      for (const f of fresh) {
        const sv = await postFindingServer(f);
        saved.push(sv || f);
      }
      const merged = [...saved, ...findings].slice(0, 200);
      setFindings(merged);
      saveLocalFindings(merged);
    } finally { setBusy(false); }
  };

  const setStatus = async (id: string, status: KaizenFinding['status']) => {
    await patchFindingServer(id, { status });
    const next = findings.map((f) => (f.id === id ? { ...f, status } : f));
    setFindings(next); saveLocalFindings(next);
  };

  const promote = async (f: KaizenFinding) => {
    const entry = promoteFinding(f);
    await postKnowledgeServer(entry);
    const local = addKnowledge(entry);
    const remote = await fetchKnowledgeServer();
    setKnowledge(remote || local);
    await setStatus(f.id, 'da-kiem-chung');
  };

  const toggleKnowledge = async (id: string, active: boolean) => {
    await patchKnowledgeServer(id, { active });
    const next = (active ? reactivateKnowledge(id) : deactivateKnowledge(id)).map((k) =>
      k.effect ? k : { ...k, effect: 'research' as const }
    );
    setKnowledge(next);
  };

  const setEffect = async (id: string, effect: 'block' | 'warn' | 'research') => {
    if (!window.confirm(`Đặt luật này thành "${effect === 'block' ? 'CHẶN tín hiệu' : effect === 'warn' ? 'CẢNH BÁO' : 'chỉ NGHIÊN CỨU'}"? Luật CHẶN sẽ loại tín hiệu khỏi RADAR ngay khi khớp.`)) return;
    await patchKnowledgeServer(id, { effect });
    const next = loadKnowledge().map((k) => (k.id === id ? { ...k, effect, updatedAt: Date.now() } : k));
    try { localStorage.setItem('nexuspilot-knowledge-v1', JSON.stringify(next)); } catch { /* giữ cũ */ }
    setKnowledge(next.map((k) => (k.effect ? k : { ...k, effect: 'research' as const })));
  };

  const activeFindings = findings.filter((f) => f.status === 'moi' || f.status === 'dang-theo-doi');

  return (
    <div className="glass-panel p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
          <BrainCircuit size={16} className="text-cyan-400" />
          KAIZEN ENGINE — SINH FINDING TỪ DỮ LIỆU THẬT
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${server ? 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10' : 'text-amber-300 border-amber-500/40 bg-amber-500/10'}`}>
            {server ? 'SERVER' : 'LOCAL'}
          </span>
        </div>
        <button
          onClick={runEngine} disabled={busy || !canRun}
          className="text-xs px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold disabled:opacity-40 flex items-center gap-1.5"
        >
          <FlaskConical size={14} /> {busy ? 'ĐANG PHÂN TÍCH…' : 'SINH FINDING'}
        </button>
      </div>
      {!canRun && (
        <div className="text-xs text-slate-500 bg-[#0b0f19] p-4 rounded-lg border border-[#1e2b48] text-center">
          Chưa đủ dữ liệu thật (cần ≥10 lệnh hệ thống hoặc ≥20 lệnh benchmark mỗi bên). Engine không bịa finding khi thiếu mẫu.
        </div>
      )}

      {activeFindings.length > 0 && (
        <div className="space-y-2">
          {activeFindings.map((f) => (
            <div key={f.id} className="bg-[#0b0f19] p-3 rounded-lg border border-[#1e2b48] space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${SEV_STYLE[f.severity]}`}>{f.severity.toUpperCase()}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-slate-500/30 text-slate-400">{STATUS_LABEL[f.status]}</span>
                <span className="text-xs font-bold text-slate-200">{f.title}</span>
              </div>
              <div className="text-[11px] text-slate-400">📊 {f.evidence}</div>
              <div className="text-[11px] text-slate-500">💡 Giả thuyết: {f.hypothesis}</div>
              <div className="text-[11px] text-cyan-300">👉 {f.action}</div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => promote(f)} className="text-[10px] px-2 py-1 rounded bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 flex items-center gap-1">
                  <CheckCircle2 size={12} /> Duyệt → Kho kiến thức
                </button>
                {f.status === 'moi' && (
                  <button onClick={() => setStatus(f.id, 'dang-theo-doi')} className="text-[10px] px-2 py-1 rounded bg-[#17223b] text-slate-300 border border-[#243356] hover:text-white flex items-center gap-1">
                    <Eye size={12} /> Theo dõi
                  </button>
                )}
                <button onClick={() => setStatus(f.id, 'da-bac-bo')} className="text-[10px] px-2 py-1 rounded bg-[#17223b] text-slate-500 border border-[#243356] hover:text-rose-300 flex items-center gap-1">
                  <XCircle size={12} /> Bác bỏ
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* KHO KIẾN THỨC */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
          <BookOpen size={14} className="text-violet-400" />
          KHO KIẾN THỨC — LUẬT ĐÃ KIỂM CHỨNG ({knowledge.filter((k) => k.active).length} đang hiệu lực)
        </div>
        {knowledge.length === 0 ? (
          <div className="text-[11px] text-slate-500 bg-[#0b0f19] p-3 rounded-lg border border-[#1e2b48] text-center">
            Chưa có luật nào. Duyệt finding ở trên để đưa vào kho — Phase C (cổng RADAR) sẽ dùng kho này để lọc nhiễu.
          </div>
        ) : (
          knowledge.map((k) => (
            <div key={k.id} className={`p-2.5 rounded-lg border text-[11px] ${k.active ? 'bg-[#0b0f19] border-[#1e2b48]' : 'bg-[#0b0f19]/50 border-[#1e2b48]/50 opacity-60'}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${k.label === 'FACT' ? 'text-emerald-300 border-emerald-500/40' : k.label === 'TINH_TOAN' ? 'text-sky-300 border-sky-500/40' : 'text-slate-400 border-slate-500/40'}`}>{k.label}</span>
                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border font-bold ${(k.effect || 'research') === 'block' ? 'text-rose-300 border-rose-500/40 bg-rose-500/10' : (k.effect || 'research') === 'warn' ? 'text-amber-300 border-amber-500/40 bg-amber-500/10' : 'text-slate-400 border-slate-500/40'}`}>
                  {(k.effect || 'research') === 'block' ? '🚫 CHẶN' : (k.effect || 'research') === 'warn' ? '⚠️ CẢNH BÁO' : '🔬 NGHIÊN CỨU'}
                </span>
                <span className="text-slate-200 font-bold">{k.rule}</span>
                <select
                  value={k.effect || 'research'}
                  onChange={(e) => setEffect(k.id, e.target.value as 'block' | 'warn' | 'research')}
                  className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-[#17223b] text-slate-300 border border-[#243356] cursor-pointer"
                  title="Tác dụng trong cổng RADAR"
                >
                  <option value="research">🔬 Nghiên cứu</option>
                  <option value="warn">⚠️ Cảnh báo</option>
                  <option value="block">🚫 Chặn tín hiệu</option>
                </select>
                <button onClick={() => toggleKnowledge(k.id, !k.active)} className="text-[10px] px-2 py-0.5 rounded bg-[#17223b] text-slate-400 border border-[#243356] hover:text-white">
                  {k.active ? 'Tạm ngưng' : 'Kích hoạt lại'}
                </button>
              </div>
              <div className="text-slate-500 mt-1 font-mono text-[10px]">
                độ tin cậy {k.confidence} · mẫu {k.sampleSize} · nguồn {k.source || 'thủ công'}
                {k.conditions.length > 0 && ` · đk: ${k.conditions.map((c) => `${c.field} ${c.op} ${JSON.stringify(c.value)}`).join(', ')}`}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
