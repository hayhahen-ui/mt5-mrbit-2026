import { useState, useEffect, useMemo } from 'react';
import { fetchAllFred, FredSeries, FredSeriesId } from './fred';
import { computeDirectionScore, DirectionResult } from './directionScore';
import { Signal } from '../../types';

export const RESEARCH_SYMBOLS = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD'];

/** Hook: tải FRED 1 lần, tính direction score cho 4 mã Blueprint. Dùng chung cho ResearchTab & RadarTab. */
export function useDirectionScores(signals: Record<string, Signal>): {
  scores: Record<string, DirectionResult>;
  fredLoaded: boolean;
} {
  const [fred, setFred] = useState<Record<FredSeriesId, FredSeries> | null>(null);

  useEffect(() => {
    let alive = true;
    fetchAllFred().then((d) => { if (alive) setFred(d); });
    return () => { alive = false; };
  }, []);

  const scores = useMemo(() => {
    const out: Record<string, DirectionResult> = {};
    if (!fred) return out;
    for (const sym of RESEARCH_SYMBOLS) {
      const sig = signals[sym];
      out[sym] = computeDirectionScore({
        symbol: sym,
        fred,
        priceDirection: sig?.direction || 'FLAT',
        priceScore: sig?.scoreBreakdown ? sig.scoreBreakdown.reduce((s, f: any) => s + f.points, 0) : 0,
      });
    }
    return out;
  }, [fred, signals]);

  return { scores, fredLoaded: !!fred };
}
