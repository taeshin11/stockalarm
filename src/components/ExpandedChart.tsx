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

export default function ExpandedChart({ ticker, onClose }: ExpandedChartProps) {
  const t = useTranslations('chart');
  const tTime = useTranslations('time');
  const { stocks, prices, setTargetPrice } = useWatchlistStore();
  const stock = stocks.find(s => s.ticker === ticker);
  const priceData = prices[ticker];
  const [range, setRange] = useState('1M');
  const [historyData, setHistoryData] = useState<HistoricalDataPoint[]>([]);
  const [targetInput, setTargetInput] = useState(stock?.targetPrice?.toString() || '');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetchHistoricalData(ticker, range).then(setHistoryData);
  }, [ticker, range]);

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
    const minP = Math.min(...closePrices);
    const maxP = Math.max(...closePrices);
    const rangeP = maxP - minP || 1;
    const padding = 8;

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

    // Price line
    const isUp = closePrices[closePrices.length - 1] >= closePrices[0];
    ctx.beginPath();
    ctx.strokeStyle = isUp ? '#4ade80' : '#f87171';
    ctx.lineWidth = 2;

    closePrices.forEach((p, i) => {
      const x = (i / (closePrices.length - 1)) * w;
      const y = h - padding - ((p - minP) / rangeP) * (h - padding * 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, isUp ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Target line
    const targetPrice = stock?.targetPrice;
    if (targetPrice && targetPrice >= minP && targetPrice <= maxP) {
      const targetY = h - padding - ((targetPrice - minP) / rangeP) * (h - padding * 2);
      ctx.beginPath();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.moveTo(0, targetY);
      ctx.lineTo(w, targetY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.fillText('Target: $' + targetPrice.toFixed(2), w - 120, targetY - 5);
    }

    // Volume bars at bottom
    const maxVol = Math.max(...historyData.map(d => d.volume));
    if (maxVol > 0) {
      const barW = Math.max(1, w / historyData.length - 1);
      historyData.forEach((d, i) => {
        const x = (i / (historyData.length - 1)) * w;
        const barH = (d.volume / maxVol) * h * 0.15;
        ctx.fillStyle = d.close >= d.open ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)';
        ctx.fillRect(x - barW / 2, h - barH, barW, barH);
      });
    }
  }, [historyData, stock?.targetPrice]);

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
      <div className="sa-card w-full max-w-3xl p-6" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
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

        {/* Time range selector */}
        <div className="flex gap-2 mb-4">
          {['1D', '1W', '1M', '3M', '1Y'].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                range === r ? 'bg-sa-accent text-white' : 'bg-sa-bg text-sa-text-secondary hover:text-sa-text'
              }`}
            >
              {tTime(r)}
            </button>
          ))}
        </div>

        {/* Chart */}
        <canvas ref={canvasRef} className="w-full h-64 sm:h-80 mb-4" />

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
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
        <div className="flex gap-2 items-center">
          <input
            type="number"
            value={targetInput}
            onChange={(e) => setTargetInput(e.target.value)}
            placeholder={t('targetPrice')}
            className="flex-1 bg-sa-bg border border-sa-border rounded-lg px-3 py-2 text-sm text-sa-text outline-none focus:border-sa-accent"
            onKeyDown={(e) => e.key === 'Enter' && handleSetTarget()}
          />
          <button onClick={handleSetTarget} className="sa-btn-primary">
            {t('setTarget')}
          </button>
          {stock.targetPrice && (
            <button
              onClick={() => setTargetPrice(ticker, undefined)}
              className="sa-btn-secondary text-sa-alert"
            >
              {t('removeTarget')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
