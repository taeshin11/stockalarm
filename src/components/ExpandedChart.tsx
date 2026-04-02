'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { X, BarChart3, TrendingUp } from 'lucide-react';
import { useWatchlistStore } from '@/store/useWatchlistStore';
import { fetchHistoricalData, HistoricalDataPoint } from '@/lib/stockApi';

interface ExpandedChartProps {
  ticker: string;
  onClose: () => void;
}

const MA_PERIODS = [5, 10, 20, 100, 200];
const MA_COLORS: Record<number, string> = {
  5: '#f59e0b',
  10: '#8b5cf6',
  20: '#06b6d4',
  100: '#f97316',
  200: '#ec4899',
};

function calculateMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += data[j];
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
  const [chartType, setChartType] = useState<'candle' | 'line'>('candle');
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
    const n = historyData.length;
    const closePrices = historyData.map(d => d.close);

    if (closePrices.length < 2) return;

    // Price range from OHLC (not just close)
    let allLows = historyData.map(d => d.low).filter(v => v > 0);
    let allHighs = historyData.map(d => d.high).filter(v => v > 0);
    if (allLows.length === 0) allLows = closePrices;
    if (allHighs.length === 0) allHighs = closePrices;
    const minP = Math.min(...allLows);
    const maxP = Math.max(...allHighs);
    const targetPrice = stock?.targetPrice;
    const rangeP = maxP - minP || 1;

    const chartTop = 8;
    const chartBottom = h * 0.85; // leave bottom 15% for volume
    const chartH = chartBottom - chartTop;

    const priceToY = (p: number) => chartBottom - ((p - minP) / rangeP) * chartH;

    ctx.clearRect(0, 0, w, h);

    // Grid lines + price labels
    ctx.strokeStyle = '#2a2f3e';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = chartTop + (i / 4) * chartH;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();

      const priceLabel = (maxP - (i / 4) * rangeP).toFixed(2);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText('$' + priceLabel, 4, y - 3);
    }

    // Candle / bar width
    const candleSpacing = w / n;
    const candleW = Math.max(1, candleSpacing * 0.6);

    // Moving Averages
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
        const x = (i + 0.5) * candleSpacing;
        const y = priceToY(val);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    if (chartType === 'candle') {
      // === CANDLESTICK CHART ===
      historyData.forEach((d, i) => {
        const x = (i + 0.5) * candleSpacing;
        const open = d.open || d.close;
        const close = d.close;
        const high = d.high || Math.max(open, close);
        const low = d.low || Math.min(open, close);
        const bullish = close >= open;

        const bodyTop = priceToY(Math.max(open, close));
        const bodyBot = priceToY(Math.min(open, close));
        const bodyH = Math.max(1, bodyBot - bodyTop);

        // Wick (high-low line)
        ctx.beginPath();
        ctx.strokeStyle = bullish ? '#4ade80' : '#f87171';
        ctx.lineWidth = 1;
        ctx.moveTo(x, priceToY(high));
        ctx.lineTo(x, priceToY(low));
        ctx.stroke();

        // Body
        if (bullish) {
          ctx.fillStyle = '#4ade80';
          ctx.strokeStyle = '#4ade80';
        } else {
          ctx.fillStyle = '#f87171';
          ctx.strokeStyle = '#f87171';
        }

        if (bodyH <= 1) {
          // Doji - just a line
          ctx.beginPath();
          ctx.moveTo(x - candleW / 2, bodyTop);
          ctx.lineTo(x + candleW / 2, bodyTop);
          ctx.stroke();
        } else if (bullish) {
          // Hollow bullish candle (or filled green)
          ctx.fillRect(x - candleW / 2, bodyTop, candleW, bodyH);
        } else {
          // Filled red bearish candle
          ctx.fillRect(x - candleW / 2, bodyTop, candleW, bodyH);
        }
      });
    } else {
      // === LINE CHART ===
      const isUp = closePrices[closePrices.length - 1] >= closePrices[0];
      ctx.beginPath();
      ctx.strokeStyle = isUp ? '#4ade80' : '#f87171';
      ctx.lineWidth = 2;

      closePrices.forEach((p, i) => {
        const x = (i + 0.5) * candleSpacing;
        const y = priceToY(p);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Gradient fill
      const gradient = ctx.createLinearGradient(0, 0, 0, chartBottom);
      gradient.addColorStop(0, isUp ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.lineTo((n - 0.5) * candleSpacing, chartBottom);
      ctx.lineTo(0.5 * candleSpacing, chartBottom);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    // Target line
    if (targetPrice) {
      const inRange = targetPrice >= minP && targetPrice <= maxP;
      let targetY: number;
      if (inRange) {
        targetY = priceToY(targetPrice);
      } else if (targetPrice > maxP) {
        targetY = chartTop + 4;
      } else {
        targetY = chartBottom - 4;
      }

      ctx.beginPath();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.moveTo(0, targetY);
      ctx.lineTo(w, targetY);
      ctx.stroke();
      ctx.setLineDash([]);

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
    const volTop = chartBottom + 4;
    const volH = h - volTop - 2;
    const maxVol = Math.max(...historyData.map(d => d.volume));
    if (maxVol > 0 && volH > 5) {
      historyData.forEach((d, i) => {
        const x = (i + 0.5) * candleSpacing;
        const barH = (d.volume / maxVol) * volH;
        const bullish = d.close >= d.open;
        ctx.fillStyle = bullish ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)';
        ctx.fillRect(x - candleW / 2, h - 2 - barH, candleW, barH);
      });
    }
  }, [historyData, stock?.targetPrice, activeMAs, chartType]);

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

        {/* Controls row: Chart type + Time range + MA */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {/* Chart type toggle */}
          <div className="flex bg-sa-bg rounded-lg p-0.5">
            <button
              onClick={() => setChartType('candle')}
              className={`p-1.5 rounded transition-colors ${chartType === 'candle' ? 'bg-sa-accent text-white' : 'text-sa-text-secondary hover:text-sa-text'}`}
              title="Candlestick"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setChartType('line')}
              className={`p-1.5 rounded transition-colors ${chartType === 'line' ? 'bg-sa-accent text-white' : 'text-sa-text-secondary hover:text-sa-text'}`}
              title="Line"
            >
              <TrendingUp className="w-4 h-4" />
            </button>
          </div>

          <div className="w-px h-5 bg-sa-border" />

          {/* Time range */}
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

          <div className="w-px h-5 bg-sa-border" />

          {/* MA toggles */}
          <div className="flex gap-1">
            {MA_PERIODS.map((period) => (
              <button
                key={period}
                onClick={() => toggleMA(period)}
                className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
                  activeMAs.has(period) ? 'text-white' : 'bg-sa-bg text-sa-text-secondary hover:text-sa-text'
                }`}
                style={activeMAs.has(period) ? { backgroundColor: MA_COLORS[period] } : undefined}
              >
                MA{period}
              </button>
            ))}
          </div>
        </div>

        {/* MA Legend */}
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
        <canvas ref={canvasRef} className="w-full h-64 sm:h-80 mb-3" />

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

        {/* Target price */}
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

        {/* Current target info */}
        {stock.targetPrice && (
          <div className="mt-2 text-xs text-sa-alert flex items-center gap-1">
            <span className="w-4 h-0 inline-block" style={{ borderTop: '1.5px dashed #ef4444' }} />
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
