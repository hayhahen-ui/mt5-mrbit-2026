import React, { useState, useEffect, useMemo } from 'react';
import { BookOpen, Search, Key, TrendingUp, AlertTriangle, ExternalLink, RefreshCw, FlaskConical } from 'lucide-react';
import {
  RESEARCH_SOURCES, TIER_META, ASSET_DRIVERS, sourceById,
  EVIDENCE_META, EvidenceLabel, SourceTier,
} from '../../data/researchRegistry';
import {
  fetchAllFred, getFredKey, setFredKey, clearFredCache,
  FRED_SERIES_META, FredSeries, FredSeriesId,
} from '../../lib/research/fred';
import { computeDirectionScore, directionBadge, DirectionResult } from '../../lib/research/directionScore';
import { Signal } from '../../types';

interface ResearchTabProps {
  signals: Record<string, Signal>;
}

const RESEARCH_SYMBOLS = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD'];

function EvidenceTag({ label }: { label: EvidenceLabel }) {
  const m = EVIDENCE_META[label];
  return (
    <span title={m.desc} className={`text-[9px] font-mono px-1.5 py-0.5 rounded border font-bold ${m.cls}`}>
      {m.label}
    </span>
  );
}

export const ResearchTab: React.FC<ResearchTabProps> = ({ signals }) => {
  const [section, setSection] = useState<'factors' | 'sources'>('factors');
  const [symbol, setSymbol] = useState('EURUSD');
  const [tierFilter, setTierFilter] = useState<SourceTier | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [fred, setFred] = useState<Record<FredSeriesId, FredSeries> | null>(null);
  const [fredLoading, setFredLoading] = useState(false);
  const [keyInput, setKeyInput] = useState(getFredKey());
  const [keySaved, setKeySaved] = useState(!!getFredKey());

  const loadFred = async () => {
    setFredLoading(true);
    const data = await fetchAllFred();
    setFred(data);
    setFredLoading(false);
  };

  useEffect(() => { loadFred(); }, []);

  const saveKey = () => {
    setFredKey(keyInput);
    setKeySaved(!!keyInput.trim());
    clearFredCache();
    loadFred();
  };

  const drivers = useMemo(() => ASSET_DRIVERS.find((d) => d.symbol === symbol)!, [symbol]);

  const direction: DirectionResult | null = useMemo(() => {
    if (!fred) return null;
    const sig = signals[symbol];
    return computeDirectionScore({
      symbol,
      fred,
      priceDirection: sig?.direction || 'FLAT',
      priceScore: sig?.scoreBreakdown ? sig.scoreBreakdown.reduce((s, f: any) => s + f.points, 0) : 0,
    });
  }, [fred, signals, symbol]);

  const filteredSources = useMemo(() => {
    const q = search.toLowerCase();
    return RESEARCH_SOURCES.filter((s) => {
      if (tierFilter !== 'ALL' && s.tier !== tierFilter) return false;
      if (q && !(s.name + s.provides + s.id).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tierFilter, search]);

  const fredOk = fred && Object.values(fred).some((s) => !s.error && s.latest);

  return (
    <div className="space-y-4">
      {/* Header + section switch */}
      <div className="glass-panel p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FlaskConical size={18} className="text-violet-400" />
          <div>
            <div className="font-bold text-sm text-slate-100">NGHIÊN CỨU VĨ MÔ (BLUEPRINT FX&GOLD)</div>
            <div className="text-[11px] text-slate-400">Truy tìm nguồn → đọc dữ kiện → tổng hợp yếu tố tác động giá → chấm điểm định hướng</div>
          </div>
        </div>
        <div className="flex gap-1.5">
          {([['factors', '📊 Yếu tố & Điểm'], ['sources', '📚 Truy tìm nguồn']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setSection(k)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                section === k ? 'bg-violet-500/20 text-violet-300 border-violet-500/40' : 'bg-[#0b0f19] text-slate-400 border-[#1e2b48] hover:text-white'
              }`}>{label}</button>
          ))}
        </div>
      </div>

      {section === 'factors' && (
        <>
          {/* FRED key */}
          <div className="glass-panel p-4 flex flex-wrap items-center gap-2">
            <Key size={15} className="text-amber-400" />
            <span className="text-xs font-bold text-slate-200">FRED API key</span>
            <span className="text-[10px] text-slate-500">miễn phí tại fred.stlouisfed.org — lưu trên máy bạn</span>
            <input value={keyInput} onChange={(e) => setKeyInput(e.target.value)} type="password" placeholder="Dán key…"
              className="bg-[#0b0f19] border border-[#1e2b48] rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 w-56 focus:outline-none focus:border-violet-500" />
            <button onClick={saveKey} className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-violet-600/30 border border-violet-500/50 text-violet-200 hover:bg-violet-600/50">Lưu & tải</button>
            {keySaved && <span className="text-[10px] text-emerald-400 font-mono">✓ đã lưu</span>}
            <button onClick={loadFred} disabled={fredLoading} className="ml-auto flex items-center gap-1 text-[11px] text-slate-400 hover:text-white">
              <RefreshCw size={12} className={fredLoading ? 'animate-spin' : ''} /> Tải lại
            </button>
          </div>

          {/* Symbol selector */}
          <div className="flex gap-1.5">
            {RESEARCH_SYMBOLS.map((s) => (
              <button key={s} onClick={() => setSymbol(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-colors ${
                  symbol === s ? 'bg-violet-500/20 text-violet-300 border-violet-500/40' : 'bg-[#0b0f19] text-slate-400 border-[#1e2b48] hover:text-white'
                }`}>#{s}</button>
            ))}
          </div>

          {/* FRED data cards */}
          <div className="glass-panel p-4 space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={15} className="text-sky-400" />
              <span className="font-bold text-xs text-slate-100">DỮ LIỆU FRED (TẦNG B)</span>
              <EvidenceTag label="FACT" />
            </div>
            {!fredOk && (
              <div className="text-[11px] text-amber-300/90 border border-amber-800/50 bg-amber-950/30 rounded-lg p-2.5">
                {fredLoading ? 'Đang tải FRED…' : 'Chưa có dữ liệu FRED — nhập API key ở trên để kích hoạt yếu tố vĩ mô.'}
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {(Object.keys(FRED_SERIES_META) as FredSeriesId[]).map((id) => {
                const meta = FRED_SERIES_META[id];
                const s = fred?.[id];
                const up = s?.change !== null && s?.change !== undefined && s.change > 0;
                return (
                  <div key={id} className="rounded-lg border border-[#1e2b48] bg-[#0d1526] p-2.5">
                    <div className="text-[10px] font-bold text-slate-300">{meta.label}</div>
                    <div className="text-[9px] text-slate-500 font-mono mb-1">{id}</div>
                    {s?.error ? (
                      <div className="text-[10px] text-slate-500 italic">—</div>
                    ) : (
                      <>
                        <div className="font-mono font-bold text-sm text-slate-100">
                          {s?.latest?.value?.toFixed(2)} <span className="text-[9px] text-slate-500 font-normal">{meta.unit}</span>
                        </div>
                        <div className={`text-[10px] font-mono ${up ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {s?.change !== null && s?.change !== undefined ? `${s.change >= 0 ? '+' : ''}${s.change.toFixed(2)}` : '—'}
                          <span className="text-slate-500"> · {s?.latest?.date}</span>
                        </div>
                      </>
                    )}
                    <div className="text-[9px] text-slate-500 mt-1">{meta.desc}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Direction score */}
          {direction && (
            <div className="glass-panel p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-slate-100">ĐIỂM ĐỊNH HƯỚNG #{symbol} (Blueprint §9.2)</span>
                  <EvidenceTag label="CALCULATION" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-mono">Bao phủ: <strong className="text-slate-200">{direction.coveragePct}%</strong></span>
                  <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded border ${
                    direction.bias === 'TĂNG' ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                    : direction.bias === 'GIẢM' ? 'bg-rose-950 text-rose-400 border-rose-800'
                    : 'bg-[#17223b] text-slate-400 border-[#243356]'
                  }`}>{directionBadge(direction)} · {direction.bias}</span>
                </div>
              </div>
              {direction.coveragePct < 70 && (
                <div className="text-[11px] text-amber-300/90 border border-amber-800/50 bg-amber-950/30 rounded-lg p-2.5 flex gap-1.5">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  <span>Độ bao phủ {direction.coveragePct}% &lt; 70% — <strong>không phát thiên hướng tổng hợp</strong> (Blueprint §9.2). Nhập FRED key và bổ sung COT/WGC tay để tăng bao phủ.</span>
                </div>
              )}
              <div className="space-y-2">
                {direction.groups.map((g) => (
                  <div key={g.id} className="rounded-lg border border-[#1e2b48] bg-[#0d1526] p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-200">{g.label}</span>
                        <EvidenceTag label={g.evidence} />
                        <span className="text-[9px] text-slate-500 font-mono">trọng số {g.weight}</span>
                      </div>
                      <span className={`font-mono font-bold text-sm ${g.score === null ? 'text-slate-500' : g.score > 0 ? 'text-emerald-400' : g.score < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                        {g.score === null ? '—' : `${g.score > 0 ? '+' : ''}${g.score}`}
                      </span>
                    </div>
                    {/* thanh -2..+2 */}
                    <div className="relative h-1.5 bg-[#17223b] rounded-full my-1.5">
                      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-600" />
                      {g.score !== null && (
                        <div className={`absolute top-0 bottom-0 rounded-full ${g.score > 0 ? 'bg-emerald-500' : g.score < 0 ? 'bg-rose-500' : 'bg-slate-500'}`}
                          style={g.score > 0 ? { left: '50%', width: `${g.score * 25}%` } : { right: '50%', width: `${-g.score * 25}%` }} />
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400">{g.detail}</div>
                    {g.sourceIds.length > 0 && (
                      <div className="text-[10px] text-slate-500 mt-1">
                        Nguồn: {g.sourceIds.map((id) => { const s = sourceById(id); return s ? <a key={id} href={s.url} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline mr-2">{s.name}</a> : null; })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="text-[10px] text-slate-500 italic">
                Điểm = Σ(trọng số × điểm nhóm / 2), miền -100..+100. Không chuyển thành xác suất thắng. Nhóm thiếu dữ liệu không cộng điểm và không coi là trung tính.
              </div>
            </div>
          )}

          {/* Key questions & pitfalls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="glass-panel p-4 space-y-2">
              <div className="font-bold text-xs text-slate-100">❓ CÂU HỎI BẮT BUỘC (Blueprint §5)</div>
              {drivers.keyQuestions.map((q, i) => (
                <div key={i} className="text-[11px] text-slate-300 flex gap-2"><span className="text-violet-400 font-bold">{i + 1}.</span>{q}</div>
              ))}
            </div>
            <div className="glass-panel p-4 space-y-2">
              <div className="font-bold text-xs text-slate-100">⚠️ ĐIỂM DỄ SAI</div>
              {drivers.pitfalls.map((p, i) => (
                <div key={i} className="text-[11px] text-amber-200/80 flex gap-2"><span>•</span>{p}</div>
              ))}
              <div className="pt-2 border-t border-[#1e2b48]">
                <div className="text-[10px] font-bold text-slate-400 mb-1">NGUỒN CHÍNH SÁCH & DỮ LIỆU</div>
                <div className="flex flex-wrap gap-1.5">
                  {[...drivers.policy, ...drivers.data].map((id) => { const s = sourceById(id); return s ? (
                    <a key={id} href={s.url} target="_blank" rel="noreferrer" className="text-[10px] px-2 py-0.5 rounded bg-[#17223b] border border-[#243356] text-sky-400 hover:text-sky-300 flex items-center gap-1">
                      {s.name}<ExternalLink size={9} />
                    </a> ) : null; })}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {section === 'sources' && (
        <div className="glass-panel p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <BookOpen size={15} className="text-violet-400" />
            <span className="font-bold text-xs text-slate-100">TRUY TÌM NGUỒN (REGISTRY §4, §22)</span>
            <div className="relative ml-auto">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm nguồn…"
                className="bg-[#0b0f19] border border-[#1e2b48] rounded-lg pl-7 pr-2 py-1.5 text-xs text-slate-200 w-48 focus:outline-none focus:border-violet-500" />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(['ALL', 'A', 'B', 'C', 'D', 'E'] as const).map((t) => (
              <button key={t} onClick={() => setTierFilter(t)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono border transition-colors ${
                  tierFilter === t ? 'bg-violet-500/20 text-violet-300 border-violet-500/40' : 'bg-[#0b0f19] text-slate-400 border-[#1e2b48] hover:text-white'
                }`}>{t === 'ALL' ? 'TẤT CẢ' : `TẦNG ${t}`}</button>
            ))}
            <span className="text-[10px] text-slate-500 ml-auto self-center">{filteredSources.length} nguồn</span>
          </div>
          {(Object.keys(TIER_META) as SourceTier[]).filter((t) => tierFilter === 'ALL' || tierFilter === t).map((tier) => {
            const list = filteredSources.filter((s) => s.tier === tier);
            if (!list.length) return null;
            return (
              <div key={tier}>
                <div className="text-[11px] font-bold text-slate-300 mt-2 mb-1.5">{TIER_META[tier].title} <span className="font-normal text-slate-500">— {TIER_META[tier].desc}</span></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {list.map((s) => (
                    <div key={s.id} className="rounded-lg border border-[#1e2b48] bg-[#0d1526] p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <a href={s.url} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-sky-400 hover:text-sky-300 flex items-center gap-1">
                          [{s.id}] {s.name}<ExternalLink size={10} />
                        </a>
                        <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${
                          s.access === 'public_web' ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                          : s.access === 'api_key_free' ? 'bg-sky-950 text-sky-400 border-sky-800'
                          : 'bg-[#17223b] text-slate-500 border-[#243356]'
                        }`}>{s.access === 'public_web' ? 'WEB' : s.access === 'api_key_free' ? 'API FREE' : s.access === 'manual_only' ? 'ĐỌC TAY' : 'CHƯA XN'}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">{s.provides}</div>
                      <div className="text-[9px] text-slate-500 mt-0.5">🔄 {s.frequency}</div>
                      {s.note && <div className="text-[9px] text-amber-200/70 italic mt-0.5">💡 {s.note}</div>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          <div className="text-[10px] text-slate-500 italic border-t border-[#1e2b48] pt-2">
            Đọc được trang web ≠ quyền API/thương mại (§4.3). Không scraping vượt paywall. API key chỉ lưu localStorage máy bạn.
          </div>
        </div>
      )}
    </div>
  );
};
