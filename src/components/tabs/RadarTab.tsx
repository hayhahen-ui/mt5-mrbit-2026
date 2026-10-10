import React from 'react';
import { Asset } from '../../types';
import { Radar, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, Eye } from 'lucide-react';

interface RadarTabProps {
  assets: Asset[];
  selectedAsset: Asset;
  onSelectAsset: (asset: Asset) => void;
}

export const RadarTab: React.FC<RadarTabProps> = ({ assets, selectedAsset, onSelectAsset }) => {
  return (
    <div className="space-y-4">
      <div className="glass-panel p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radar size={18} className="text-sky-400" />
            <span className="font-bold text-sm text-slate-100">RADAR QUÉT ĐA CẶP THỜI GIAN THỰC (MULTI-ASSET SCANNER)</span>
          </div>
          <span className="text-xs text-slate-400 font-mono">Bấm một thẻ để chuyển đổi Cockpit</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {assets.map((asset) => {
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
