'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { useWatchlistStore } from '@/store/useWatchlistStore';
import { fetchHistoricalData, HistoricalDataPoint } from '@/lib/stockApi';

interface ExpandedChartProps {
  ticker: string;
  onClose: () => void;
}

const MA_PERIODS = [5, 10, 20, 100, 200];
const MA_COLORS: Record<number, string> = {
  5: '#f59e0b',   // amber
  10: '#8b5cf6',  // purple
  20: '#06b6d4',  // cyan
  100: '#f97316', // orange
  200: '#ec4899', // pink
};

function calculateMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += data[j];
      }
      result.push(sum / period);
    }
  }
  return result;
}

export default function ExpandedChart({ ticker, onClose }: ExpandedChartProps) {
  const t = useTranslations('chart');
  const tTime = useTranslations('time');
  const { stocks, prices, setTargetPrice } = useWatchlistStore();
  const stock = stocks.find(s => s.ticker === ticker);
  const priceData = prices[ticker];
  const [range, setRange] = useState('1M');
  const [historyData, setHistoryData] = useState<HistoricalDataPoint[]>([]);
  const [targetInput, setTargetInput] = useState(stock?.targetPrice?.toString() || '');
  const [activeMAs, setActiveMAs] = useState<Set<number>>(new Set([5, 20]));
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetchHistoricalData(ticker, range).then(setHistoryData);
  }, [ticker, range]);

  const toggleMA = (period: number) => {
    setActiveMAs(prev => {
      const next = new Set(prev);
      if (next.has(period)) next.delete(period);
      else next.add(period);
      return next;
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || historyData.length < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const closePrices = historyData.map(d => d.close);

    if (closePrices.length < 2) return;
    const minP = Math.min(...closePrices);
    const maxP = Math.max(...closePrices);
    const targetPrice = stock?.targetPrice;
    const rangeP = maxP - minP || 1;
    const padding = 8;

    const priceToY = (p: number) => h - padding - ((p - minP) / rangeP) * (h - padding * 2);

    ctx.clearRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = '#2a2f3e';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = padding + (i / 4) * (h - padding * 2);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();

      const priceLabel = (maxP - (i / 4) * rangeP).toFixed(2);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText('$' + priceLabel, 4, y - 3);
    }

    // Moving Averages (draw before price line so price is on top)
    for (const period of MA_PERIODS) {
      if (!activeMAs.has(period)) continue;
      const maData = calculateMA(closePrices, period);
      ctx.beginPath();
      ctx.strokeStyle = MA_COLORS[period];
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.8;
      let started = false;
      maData.forEach((val, i) => {
        if (val === null) return;
        const x = (i / (closePrices.length - 1)) * w;
        const y = priceToY(val);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Price line
    const isUp = closePrices[closePrices.length - 1] >= closePrices[0];
    ctx.beginPath();
    ctx.strokeStyle = isUp ? '#4ade80' : '#f87171';
    ctx.lineWidth = 2;

    closePrices.forEach((p, i) => {
      const x = (i / (closePrices.length - 1)) * w;
      const y = priceToY(p);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, isUp ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Target line (always visible — range extended above)
    if (targetPrice) {
      const inRange = targetPrice >= minP && targetPrice <= maxP;
      let targetY: number;
      if (inRange) {
        targetY = priceToY(targetPrice);
      } else if (targetPrice > maxP) {
        targetY = padding + 4; // pin to top
      } else {
        targetY = h - padding - 4; // pin to bottom
      }

      ctx.beginPath();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.moveTo(0, targetY);
      ctx.lineTo(w, targetY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Target label with background
      const arrow = targetPrice > maxP ? ' ↑' : targetPrice < minP ? ' ↓' : '';
      const label = `Target: $${targetPrice.toFixed(2)}${arrow}`;
      ctx.font = 'bold 11px Inter, sans-serif';
      const textWidth = ctx.measureText(label).width;
      const labelX = w - textWidth - 10;
      const labelY = targetPrice > maxP ? targetY + 14 : targetY - 5;
      ctx.fillStyle = 'rgba(239,68,68,0.15)';
      ctx.fillRect(labelX - 4, labelY - 12, textWidth + 8, 16);
      ctx.fillStyle = '#ef4444';
      ctx.fillText(label, labelX, labelY);
    }

    // Volume bars at bottom
    const maxVol = Math.max(...historyData.map(d => d.volume));
    if (maxVol > 0) {
      const barW = Math.max(1, w / historyData.length - 1);
      historyData.forEach((d, i) => {
        const x = (i / (historyData.length - 1)) * w;
        const barH = (d.volume / maxVol) * h * 0.12;
        ctx.fillStyle = d.close >= d.open ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)';
        ctx.fillRect(x - barW / 2, h - barH, barW, barH);
      });
    }
  }, [historyData, stock?.targetPrice, activeMAs]);

  const handleSetTarget = () => {
    const value = parseFloat(targetInput);
    if (!isNaN(value) && value > 0) {
      setTargetPrice(ticker, value);
    }
  };

  if (!stock) return null;

  const price = priceData?.price ?? 0;
  const change = priceData?.change ?? 0;
  const changePercent = priceData?.changePercent ?? 0;
  const isUp = change >= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="sa-card w-full max-w-3xl p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xl font-bold text-sa-text">{stock.ticker}</h2>
            <p className="text-sm text-sa-text-secondary">{stock.name}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-2xl font-bold text-sa-text">${price.toFixed(2)}</div>
              <div className={`text-sm font-medium ${isUp ? 'text-sa-up' : 'text-sa-down'}`}>
                {isUp ? '+' : ''}{change.toFixed(2)} ({isUp ? '+' : ''}{changePercent.toFixed(2)}%)
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-sa-bg rounded-lg">
              <X className="w-5 h-5 text-sa-text-secondary" />
            </button>
          </div>
        </div>

        {/* Time range + MA selectors */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="flex gap-1">
            {['1D', '1W', '1M', '3M', '1Y'].map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  range === r ? 'bg-sa-accent text-white' : 'bg-sa-bg text-sa-text-secondary hover:text-sa-text'
                }`}
              >
                {tTime(r)}
              </button>
            ))}
          </div>
          <div className="w-px h-5 bg-sa-border mx-1" />
          <div className="flex gap-1">
            {MA_PERIODS.map((period) => (
              <button
                key={period}
                onClick={() => toggleMA(period)}
                className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
                  activeMAs.has(period)
                    ? 'text-white'
                    : 'bg-sa-bg text-sa-text-secondary hover:text-sa-text'
                }`}
                style={activeMAs.has(period) ? { backgroundColor: MA_COLORS[period] } : undefined}
              >
                MA{period}
              </button>
            ))}
          </div>
        </div>

        {/* MA Legend (only show active) */}
        {activeMAs.size > 0 && (
          <div className="flex flex-wrap gap-3 mb-2 text-[10px]">
            {MA_PERIODS.filter(p => activeMAs.has(p)).map(period => (
              <span key={period} className="flex items-center gap-1">
                <span className="w-3 h-[2px] rounded" style={{ backgroundColor: MA_COLORS[period] }} />
                <span className="text-sa-text-secondary">MA{period}</span>
              </span>
            ))}
          </div>
        )}

        {/* Chart */}
        <canvas ref={canvasRef} className="w-full h-56 sm:h-72 mb-3" />

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {[
            { label: t('high'), value: `$${priceData?.high?.toFixed(2) || '\u2014'}` },
            { label: t('low'), value: `$${priceData?.low?.toFixed(2) || '\u2014'}` },
            { label: t('volume'), value: priceData?.volume?.toLocaleString() || '\u2014' },
            { label: t('marketClosed'), value: priceData?.marketOpen ? 'Open' : 'Closed' },
          ].map((stat) => (
            <div key={stat.label} className="bg-sa-bg rounded-lg px-3 py-2">
              <div className="text-[10px] text-sa-text-secondary uppercase">{stat.label}</div>
              <div className="text-sm font-medium text-sa-text">{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Target price — fixed horizontal layout */}
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={targetInput}
            onChange={(e) => setTargetInput(e.target.value)}
            placeholder={t('targetPrice')}
            className="flex-1 min-w-0 bg-sa-bg border border-sa-border rounded-lg px-3 py-2 text-sm text-sa-text outline-none focus:border-sa-accent"
            onKeyDown={(e) => e.key === 'Enter' && handleSetTarget()}
          />
          <button onClick={handleSetTarget} className="sa-btn-primary whitespace-nowrap flex-shrink-0">
            {t('setTarget')}
          </button>
          {stock.targetPrice && (
            <button
              onClick={() => setTargetPrice(ticker, undefined)}
              className="sa-btn-secondary text-sa-alert whitespace-nowrap flex-shrink-0"
            >
              {t('removeTarget')}
            </button>
          )}
        </div>

        {/* Show current target if set */}
        {stock.targetPrice && (
          <div className="mt-2 text-xs text-sa-alert flex items-center gap-1">
            <span className="w-4 h-[1.5px] bg-sa-alert inline-block" style={{ borderTop: '1.5px dashed #ef4444' }} />
            {t('targetPrice')}: ${stock.targetPrice.toFixed(2)}
            {priceData && (
              <span className="text-sa-text-secondary ml-1">
                ({((stock.targetPrice - priceData.price) / priceData.price * 100).toFixed(1)}%)
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
