'use client';

import { useState, useEffect } from 'react';
import { fetchStockPrices } from '@/lib/stockApi';

const DEMO_TICKERS = ['AAPL', 'NVDA', 'TSLA', 'MSFT'];

interface DemoStock {
  ticker: string;
  name: string;
  price: number;
  change: number;
  pct: number;
}

export default function DemoPreview() {
  const [demoStocks, setDemoStocks] = useState<DemoStock[]>([]);

  useEffect(() => {
    fetchStockPrices(DEMO_TICKERS).then(data => {
      const stocks: DemoStock[] = DEMO_TICKERS.map(t => {
        const q = data[t];
        if (!q) return { ticker: t, name: t, price: 0, change: 0, pct: 0 };
        return {
          ticker: t,
          name: (q as any).name || t,
          price: (q as any).price || 0,
          change: (q as any).change || 0,
          pct: (q as any).changePercent || 0,
        };
      }).filter(s => s.price > 0);
      if (stocks.length > 0) setDemoStocks(stocks);
    });
  }, []);

  if (demoStocks.length === 0) return null;

  return (
    <div className="w-full max-w-4xl mx-auto mb-16">
      <p className="text-xs text-sa-text-secondary text-center mb-4 uppercase tracking-wider">Live Preview</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {demoStocks.map(s => {
          const up = s.change >= 0;
          return (
            <div key={s.ticker} className="border border-sa-border rounded-lg p-3 bg-sa-card opacity-80 pointer-events-none select-none">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sa-text text-sm">{s.ticker}</span>
                <span className={`text-xs font-medium ${up ? 'text-green-400' : 'text-red-400'}`}>
                  {up ? '+' : ''}{s.pct.toFixed(2)}%
                </span>
              </div>
              <div className="text-lg font-semibold text-sa-text mb-1">${s.price.toFixed(2)}</div>
              <div className={`text-xs ${up ? 'text-green-400' : 'text-red-400'}`}>
                {up ? '+' : ''}{s.change.toFixed(2)}
              </div>
              <svg viewBox="0 0 100 30" className="w-full h-8 mt-2" preserveAspectRatio="none">
                <polyline
                  fill="none"
                  stroke={up ? '#22c55e' : '#ef4444'}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={up
                    ? '0,22 10,20 20,24 30,18 40,20 50,15 60,17 70,12 80,14 90,10 100,8'
                    : '0,8 10,12 20,10 30,14 40,12 50,18 60,15 70,20 80,18 90,22 100,24'
                  }
                />
              </svg>
              <p className="text-[10px] text-sa-text-secondary mt-1">{s.name}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
