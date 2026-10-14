/**
 * DataFlowTab.tsx — Giám sát dòng chảy dữ liệu realtime.
 * Ping thật từng nguồn khi mở tab → đèn xanh/đỏ + animation dòng chảy theo kết quả thật.
 * Đỏ hoặc đứng yên = dữ liệu bị chặn.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Activity, RefreshCw, Zap, Database, Cpu, Radio } from 'lucide-react';
import { apiUrl } from '../../lib/apiHealth';

interface SourceDef {
  id: string;
  name: string;
  layer: 'price' | 'macro' | 'news' | 'sync';
  url: string;
  method: 'GET' | 'POST';
  check: (d: any) => boolean;
  detail: (d: any) => string;
  note: string;
}

const SOURCES: SourceDef[] = [
  { id: 'goldapi', name: 'Gold-API (XAUUSD)', layer: 'price', url: 'https://api.gold-api.com/price/XAU', method: 'GET',
    check: (d) => typeof d?.price === 'number',
    detail: (d) => `$${d.price}`,
    note: 'Realtime 60s' },
  { id: 'erapi', name: 'ER-API (Forex)', layer: 'price', url: 'https://open.er-api.com/v6/latest/USD', method: 'GET',
    check: (d) => d?.result === 'success',
    detail: (d) => `EUR ${d.rates?.EUR}`,
    note: 'Daily — intraday đứng yên' },
  { id: 'kraken', name: 'Kraken (BTC/ETH)', layer: 'price', url: 'https://api.kraken.com/0/public/Ticker?pair=XBTUSD,ETHUSD', method: 'GET',
    check: (d) => !!d?.result?.XXBTZUSD,
    detail: (d) => `BTC $${(+d.result.XXBTZUSD.c[0]).toLocaleString()}`,
    note: 'Realtime' },
  { id: 'fred', name: 'FRED kho online', layer: 'macro', url: 'https://raw.githubusercontent.com/hayhahen-ui/mt5-mrbit-2026/data/research/fred/latest.json', method: 'GET',
    check: (d) => !!d?.series,
    detail: (d) => `${Object.keys(d.series || {}).length} chuỗi`,
    note: 'Vĩ mô → directionScore' },
  { id: 'wgc', name: 'WGC gold-flows', layer: 'macro', url: 'https://raw.githubusercontent.com/hayhahen-ui/mt5-mrbit-2026/data/research/gold-flows/latest.json', method: 'GET',
    check: (d) => !!d?.wgc?.etf_monthly,
    detail: (d) => `ETF ${d.wgc.etf_monthly.period}`,
    note: 'Schema v2 → directionScore' },
  { id: 'ffcal', name: 'FF Calendar', layer: 'news', url: 'https://raw.githubusercontent.com/hayhahen-ui/mt5-mrbit-2026/data/research/ff-calendar/latest.json', method: 'GET',
    check: (d) => Array.isArray(d?.events),
    detail: (d) => `${d.events.length} sự kiện`,
    note: 'Lịch tin → lọc tin engine' },
  { id: 'shared', name: 'Shared journal API', layer: 'sync', url: '', method: 'GET',
    check: (d) => true, // 200 hoặc 400 đều = API sống (400 chỉ do group test sai format)
    detail: (d) => d?.entries ? `${d.entries.length} bản ghi` : 'API phản hồi',
    note: 'Đa thiết bị (30s poll)' },
  { id: 'digest', name: 'Bản tin hàng ngày', layer: 'macro', url: 'https://raw.githubusercontent.com/hayhahen-ui/mt5-mrbit-2026/data/research/digest/latest.json', method: 'GET',
    check: (d) => !!d?.symbols,
    detail: (d) => d?.asOf || 'OK',
    note: 'Action 08:00 VN' },
];

interface SourceStatus {
  id: string;
  ok: boolean | null; // null = đang ping
  latency: number | null;
  detail: string;
  error?: string;
}

const LAYER_META = {
  price: { label: 'GIÁ REALTIME', icon: Zap, color: '#38bdf8' },
  macro: { label: 'VĨ MÔ / NGHIÊN CỨU', icon: Database, color: '#a78bfa' },
  news: { label: 'LỊCH TIN', icon: Radio, color: '#fbbf24' },
  sync: { label: 'ĐỒNG BỘ', icon: RefreshCw, color: '#34d399' },
};

const POS_API = (): string => {
  try {
    const u = (import.meta as any).env?.VITE_POSITIONS_API_URL || '';
    return u ? u.replace(/\/$/, '') : '';
  } catch { return ''; }
};

interface KzStatus { ok: boolean | null; detail: string; }

export default function DataFlowTab() {
  const [statuses, setStatuses] = useState<Record<string, SourceStatus>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [lastCheck, setLastCheck] = useState<string>('');
  const [kz, setKz] = useState<Record<string, KzStatus>>({});
  const mounted = useRef(true);

  const pingOne = useCallback(async (src: SourceDef): Promise<SourceStatus> => {
    const t0 = performance.now();
    try {
      const url = src.id === 'shared' ? apiUrl('/api/shared?group=_health_') : src.url;
      const r = await fetch(url, { method: src.method, cache: 'no-store', signal: AbortSignal.timeout(15000) });
      const latency = Math.round(performance.now() - t0);
      let data: any = null;
      try { data = await r.json(); } catch { /* non-JSON */ }
      const alive = r.ok || (src.id === 'shared' && r.status === 400);
      const ok = alive && src.check(data);
      return { id: src.id, ok, latency, detail: ok ? src.detail(data) : `HTTP ${r.status}` };
    } catch (e: any) {
      return { id: src.id, ok: false, latency: null, detail: '', error: e?.message || 'Lỗi mạng' };
    }
  }, []);

  const pingAll = useCallback(async () => {
    setRefreshing(true);
    setStatuses(Object.fromEntries(SOURCES.map((s) => [s.id, { id: s.id, ok: null, latency: null, detail: '' }])));
    const results = await Promise.all(SOURCES.map(pingOne));
    if (!mounted.current) return;
    setStatuses(Object.fromEntries(results.map((r) => [r.id, r])));
    setLastCheck(new Date().toLocaleTimeString('vi-VN'));
    setRefreshing(false);
  }, [pingOne]);

  const pingKaizen = useCallback(async () => {
    const base = POS_API();
    const init: Record<string, KzStatus> = {
      benchmarks: { ok: null, detail: 'đang ping…' },
      findings: { ok: null, detail: 'đang ping…' },
      knowledge: { ok: null, detail: 'đang ping…' },
    };
    if (mounted.current) setKz(init);
    if (!base) {
      if (mounted.current) setKz({
        benchmarks: { ok: false, detail: 'chưa cấu hình VITE_POSITIONS_API_URL' },
        findings: { ok: false, detail: 'chưa cấu hình VITE_POSITIONS_API_URL' },
        knowledge: { ok: false, detail: 'chưa cấu hình VITE_POSITIONS_API_URL' },
      });
      return;
    }
    const get = async (path: string, pick: (d: any) => string): Promise<KzStatus> => {
      try {
        const r = await fetch(`${base}${path}`, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
        const d = await r.json().catch(() => null);
        return r.ok && d?.ok ? { ok: true, detail: pick(d) } : { ok: false, detail: `HTTP ${r.status}` };
      } catch (e: any) {
        return { ok: false, detail: e?.message || 'lỗi mạng' };
      }
    };
    const [b, f, k] = await Promise.all([
      get('/api/benchmarks', (d) => `${d.strategies?.length ?? 0} strategy`),
      get('/api/kaizen?type=findings', (d) => `${d.findings?.length ?? 0} findings`),
      get('/api/kaizen?type=knowledge', (d) => {
        const arr = d.knowledge || [];
        return `${arr.filter((x: any) => x.active).length}/${arr.length} luật hiệu lực`;
      }),
    ]);
    if (mounted.current) setKz({ benchmarks: b, findings: f, knowledge: k });
  }, []);

  useEffect(() => {
    mounted.current = true;
    pingAll();
    pingKaizen();
    return () => { mounted.current = false; };
  }, [pingAll, pingKaizen]);

  const okCount = Object.values(statuses).filter((s) => s.ok === true).length;
  const failCount = Object.values(statuses).filter((s) => s.ok === false).length;
  const pendingCount = Object.values(statuses).filter((s) => s.ok === null).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="glass-panel p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-cyan-400" />
          <div>
            <div className="font-bold text-sm text-slate-100">DÒNG CHẢY DỮ LIỆU — GIÁM SÁT REALTIME</div>
            <div className="text-[11px] text-slate-400">
              Ping thật từng nguồn khi mở tab · {lastCheck && `kiểm tra lúc ${lastCheck}`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-emerald-400">🟢 {okCount} live</span>
          {failCount > 0 && <span className="text-xs font-mono text-rose-400">🔴 {failCount} chặn</span>}
          {pendingCount > 0 && <span className="text-xs font-mono text-amber-400">🟡 {pendingCount} đang ping</span>}
          <button
            onClick={() => { pingAll(); pingKaizen(); }}
            disabled={refreshing}
            className="px-3 py-1.5 rounded-lg bg-cyan-600/20 border border-cyan-500/40 text-cyan-300 text-[11px] font-bold flex items-center gap-1.5 hover:bg-cyan-600/30 disabled:opacity-50"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> PING LẠI
          </button>
        </div>
      </div>

      {/* Sơ đồ dòng chảy */}
      <div className="glass-panel p-4">
        <div className="text-xs font-bold text-slate-300 mb-3">SƠ ĐỒ DÒNG CHẢY</div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {/* Cột 1: Nguồn */}
          <FlowColumn title="1. NGUỒN" icon="📡" color="#38bdf8">
            {(Object.keys(LAYER_META) as (keyof typeof LAYER_META)[]).map((layer) => {
              const meta = LAYER_META[layer];
              const srcs = SOURCES.filter((s) => s.layer === layer);
              return (
                <div key={layer} className="mb-2">
                  <div className="text-[9px] font-bold mb-1" style={{ color: meta.color }}>{meta.label}</div>
                  {srcs.map((src) => {
                    const st = statuses[src.id];
                    const flowing = st?.ok === true;
                    const blocked = st?.ok === false;
                    return (
                      <div
                        key={src.id}
                        className={`relative mb-1.5 p-2 rounded-lg border text-[10px] transition-colors ${
                          flowing ? 'bg-[#0b0f19] border-emerald-500/30' :
                          blocked ? 'bg-[#0b0f19] border-rose-500/50' :
                          'bg-[#0b0f19] border-[#1e2b48]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${
                            flowing ? 'bg-emerald-400 animate-pulse' :
                            blocked ? 'bg-rose-500' : 'bg-amber-400 animate-ping'
                          }`} />
                          <span className="font-bold text-slate-200">{src.name}</span>
                        </div>
                        <div className="text-slate-500 mt-0.5 ml-3.5">
                          {st?.ok === true ? `${st.detail} · ${st.latency}ms` :
                           st?.ok === false ? `🔴 ${st.error || st.detail}` :
                           'đang ping…'}
                        </div>
                        <div className="text-slate-600 mt-0.5 ml-3.5 italic">{src.note}</div>
                        {/* Dòng chảy animation */}
                        <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-3 h-0.5 overflow-hidden">
                          <div className={`h-full w-full ${flowing ? 'flow-line' : blocked ? 'bg-rose-500/50' : 'bg-slate-700'}`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </FlowColumn>

          {/* Cột 2: Thu thập */}
          <FlowColumn title="2. THU THẬP & LỌC" icon="🔍" color="#fbbf24">
            <FlowNode title="quoteGuard" desc="Chặn tick ảo >2%" live={okCount > 0} />
            <FlowNode title="API Proxy (Vercel)" desc="/api/* + CORS" live={statuses['shared']?.ok === true} />
            <FlowNode title="GitHub Actions" desc="FRED 07:30 · Digest 08:00 · FF CN" live={statuses['fred']?.ok === true} />
          </FlowColumn>

          {/* Cột 3: Kho tổng */}
          <FlowColumn title="3. KHO TỔNG (MASTERDATA)" icon="💾" color="#a78bfa">
            <FlowNode title="Journal snapshots" desc="localStorage + IDB + GitHub data" live={true} />
            <FlowNode title="FRED history" desc="284 ngày · GitHub" live={statuses['fred']?.ok === true} />
            <FlowNode title="WGC / COFER" desc="ETF · GDT · dự trữ" live={statuses['wgc']?.ok === true} />
            <FlowNode title="FF Calendar" desc="109 sự kiện" live={statuses['ffcal']?.ok === true} />
          </FlowColumn>

          {/* Cột 4: Engine → Tín hiệu */}
          <FlowColumn title="4. ENGINE → TÍN HIỆU" icon="🎯" color="#34d399">
            <FlowNode title="directionScore" desc="FRED + WGC → macroScore" live={statuses['fred']?.ok === true && statuses['wgc']?.ok === true} />
            <FlowNode title="signalEngine" desc="7 yếu tố + macroAdj" live={okCount > 0} />
            <FlowNode title="FLIGHT / RADAR" desc="Tín hiệu hiển thị" live={okCount > 0} />
            <FlowNode title="AI Proxy" desc="13 provider phân tích" live={true} />
          </FlowColumn>

          {/* Cột 5: Vòng Kaizen khép kín — ping thật API */}
          <FlowColumn title="5. VÒNG KAIZEN" icon="🔁" color="#f472b6">
            <FlowNode
              title="Đối ứng Benchmark"
              desc={kz.benchmarks?.ok ? `✅ ${kz.benchmarks.detail} · /api/benchmarks` : kz.benchmarks?.detail || 'đang ping…'}
              live={kz.benchmarks?.ok === true}
            />
            <FlowNode
              title="Kaizen Engine"
              desc={kz.findings?.ok ? `✅ ${kz.findings.detail} · /api/kaizen` : kz.findings?.detail || 'đang ping…'}
              live={kz.findings?.ok === true}
            />
            <FlowNode
              title="Kho kiến thức"
              desc={kz.knowledge?.ok ? `✅ ${kz.knowledge.detail}` : kz.knowledge?.detail || 'đang ping…'}
              live={kz.knowledge?.ok === true}
            />
            <FlowNode title="Neural (shadow)" desc="quan sát · chưa can thiệp tín hiệu" live={true} />
            <FlowNode title="Cổng RADAR" desc="Phase C — lọc nhiễu bằng knowledge + NN" live={false} />
          </FlowColumn>
        </div>
        <div className="mt-3 text-[10px] text-slate-500">
          🔁 Vòng Kaizen khép kín: dữ liệu thật (cột 3) → đối ứng → finding → kho kiến thức → <span className="text-pink-300">Phase C: cổng RADAR</span> → tín hiệu sạch, win rate max.
        </div>
        <div className="mt-3 text-[10px] text-slate-500">
          💡 Đường chảy <span className="text-emerald-400">xanh chuyển động</span> = dữ liệu đang realtime ·
          <span className="text-rose-400"> đỏ đứng yên</span> = bị chặn ·
          <span className="text-amber-400"> vàng</span> = đang kiểm tra
        </div>
      </div>

      <style>{`
        .flow-line {
          background: linear-gradient(90deg, transparent, #34d399, transparent);
          background-size: 200% 100%;
          animation: flowMove 1.2s linear infinite;
        }
        @keyframes flowMove {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

function FlowColumn({ title, icon, color, children }: { title: string; icon: string; color: string; children: React.ReactNode }) {
  return (
    <div className="p-3 rounded-xl bg-[#0d1322]/60 border border-[#1e2b48]">
      <div className="text-[10px] font-bold mb-2 flex items-center gap-1.5" style={{ color }}>
        <span>{icon}</span> {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function FlowNode({ title, desc, live }: { title: string; desc: string; live: boolean }) {
  return (
    <div className={`p-2 rounded-lg border text-[10px] ${live ? 'bg-[#0b0f19] border-[#1e2b48]' : 'bg-[#0b0f19] border-rose-500/40'}`}>
      <div className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full shrink-0 ${live ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
        <Cpu size={10} className="text-slate-500" />
        <span className="font-bold text-slate-200">{title}</span>
      </div>
      <div className="text-slate-500 mt-0.5 ml-3.5">{desc}</div>
    </div>
  );
}
