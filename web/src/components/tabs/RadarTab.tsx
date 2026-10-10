import React, { useState, useMemo } from 'react';
import { Asset } from '../../types';
import { Radar, ArrowUpRight, ArrowDownRight, ArrowUpDown } from 'lucide-react';

interface RadarTabProps {
  assets: Asset[];
  selectedAsset: Asset;
  onSelectAsset: (asset: Asset) => void;
}

type SortKey = 'quality' | 'change' | 'spread';
type CatFilter = 'ALL' | Asset['category'];

const QUALITY_RANK: Record<string, number> = { Q5: 5, Q4: 4, Q3: 3, Q2: 2, Q1: 1 };
const CATEGORIES: CatFilter[] = ['ALL', 'Forex', 'Metals', 'Crypto', 'Indices'];

export const RadarTab: React.FC<RadarTabProps> = ({ assets, selectedAsset, onSelectAsset }) => {
  const [sortKey, setSortKey] = useState<SortKey>('quality');
  const [catFilter, setCatFilter] = useState<CatFilter>('ALL');

  const visible = useMemo(() => {
    const filtered = catFilter === 'ALL' ? [...assets] : assets.filter((a) => a.category === catFilter);
    filtered.sort((a, b) => {
      if (sortKey === 'quality') return (QUALITY_RANK[b.quality] || 0) - (QUALITY_RANK[a.quality] || 0);
      if (sortKey === 'change') return Math.abs(b.change24h) - Math.abs(a.change24h);
      return a.spread - b.spread;
    });
    return filtered;
  }, [assets, sortKey, catFilter]);

  const signalCount = assets.filter((a) => a.signalDir !== 'FLAT').length;

  return (
    <div className="space-y-4">
      <div className="glass-panel p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Radar size={18} className="text-sky-400" />
            <span className="font-bold text-sm text-slate-100">RADAR QUÉT ĐA CẶP THỜI GIAN THỰC (MULTI-ASSET SCANNER)</span>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {signalCount}/{assets.length} mã có tín hiệu · Bấm một thẻ để chuyển Cockpit
          </span>
        </div>

        {/* Bộ lọc + Sắp xếp */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCatFilter(c)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono transition-colors border ${
                  catFilter === c
                    ? 'bg-sky-500/20 text-sky-400 border-sky-500/40'
                    : 'bg-[#0b0f19] text-slate-400 border-[#1e2b48] hover:text-white'
                }`}
              >
                {c === 'ALL' ? 'TẤT CẢ' : c.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <ArrowUpDown size={13} className="text-slate-400" />
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="bg-[#0b0f19] text-slate-200 text-[11px] font-mono px-2 py-1.5 rounded-lg border border-[#1e2b48] focus:outline-none focus:border-sky-500 cursor-pointer"
            >
              <option value="quality">Sắp xếp: Chất lượng tín hiệu</option>
              <option value="change">Sắp xếp: Biến động 24h</option>
              <option value="spread">Sắp xếp: Spread thấp nhất</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {visible.map((asset) => {
            const isSelected = selectedAsset.symbol === asset.symbol;
            const isPositive = asset.change24h >= 0;
            const hasSignal = asset.signalDir !== 'FLAT';

            return (
              <div
                key={asset.symbol}
                onClick={() => onSelectAsset(asset)}
                className={`p-4 rounded-xl cursor-pointer transition-all border ${
                  isSelected
                    ? 'bg-sky-950/40 border-sky-500 shadow-lg shadow-sky-950'
                    : 'bg-[#0b0f19] border-[#1e2b48] hover:border-slate-600 hover:bg-[#12192b]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-mono font-bold text-sm text-slate-100 flex items-center gap-1.5">
                      <span>#{asset.symbol}</span>
                      {hasSignal && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 radar-pulse"></span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400">{asset.name}</div>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#17223b] text-slate-400">
                    {asset.category}
                  </span>
                </div>

                <div className="flex items-baseline justify-between font-mono my-2">
                  <span className="text-base font-bold text-slate-100">
                    {asset.price.toFixed(asset.digits)}
                  </span>
                  <span className={`text-xs font-semibold flex items-center ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    {isPositive ? '+' : ''}{asset.change24h}%
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-2 border-t border-[#1e2b48] font-mono">
                  <span className="text-slate-400">Spread: {asset.spread} p</span>
                  {hasSignal ? (
                    <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                      asset.signalDir === 'BUY' ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                    }`}>
                      {asset.signalDir} ({asset.quality})
                    </span>
                  ) : (
                    <span className="text-slate-400">Đang quét...</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
