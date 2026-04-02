'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { X, Maximize2, Bell } from 'lucide-react';
import { WatchlistStock, PriceData, useWatchlistStore } from '@/store/useWatchlistStore';
import { collectData } from '@/lib/analytics';
import { fetchHistoricalData, HistoricalDataPoint } from '@/lib/stockApi';

interface MiniChartProps {
  stock: WatchlistStock;
  priceData?: PriceData;
  onExpand: () => void;
}

export default function MiniChart({ stock, priceData, onExpand }: MiniChartProps) {
  const t = useTranslations('chart');
  const { removeStock, setTargetPrice, dismissAlert, setSmartAlert } = useWatchlistStore();
  const [targetInput, setTargetInput] = useState('');
  const [showTargetInput, setShowTargetInput] = useState(false);
  const [smartAlertInput, setSmartAlertInput] = useState('');
  const [showSmartAlert, setShowSmartAlert] = useState(false);
  const [historyData, setHistoryData] = useState<HistoricalDataPoint[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const price = priceData?.price ?? 0;
  const change = priceData?.change ?? 0;
  const changePercent = priceData?.changePercent ?? 0;
  const isUp = change >= 0;

  useEffect(() => {
    fetchHistoricalData(stock.ticker, '1M').then(setHistoryData);
  }, [stock.ticker]);

  // Draw mini chart on canvas
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
    const priceRange = maxP - minP || 1;
    const padding = 4;
    const priceToY = (p: number) => h - padding - ((p - minP) / priceRange) * (h - padding * 2);

    ctx.clearRect(0, 0, w, h);

    // Price line
    ctx.beginPath();
    ctx.strokeStyle = isUp ? '#4ade80' : '#f87171';
    ctx.lineWidth = 1.5;

    closePrices.forEach((p, i) => {
      const x = (i / (closePrices.length - 1)) * w;
      const y = priceToY(p);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, isUp ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Target line — clamp to chart area, don't stretch chart range
    if (stock.targetPrice) {
      let targetY: number;
      const inRange = stock.targetPrice >= minP && stock.targetPrice <= maxP;
      if (inRange) {
        targetY = priceToY(stock.targetPrice);
      } else if (stock.targetPrice > maxP) {
        targetY = padding + 2; // pin to top
      } else {
        targetY = h - padding - 2; // pin to bottom
      }
      ctx.beginPath();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.moveTo(0, targetY);
      ctx.lineTo(w, targetY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Small label
      ctx.fillStyle = '#ef4444';
      ctx.font = '9px Inter, sans-serif';
      ctx.fillText('$' + stock.targetPrice.toFixed(0), w - 35, targetY - 3);
    }
  }, [historyData, stock.targetPrice, isUp]);

  const handleSetTarget = () => {
    const value = parseFloat(targetInput);
    if (!isNaN(value) && value > 0) {
      setTargetPrice(stock.ticker, value);
      collectData('setTarget', { ticker: stock.ticker, targetPrice: value });
      setShowTargetInput(false);
      setTargetInput('');
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeStock(stock.ticker);
    collectData('removeStock', { ticker: stock.ticker });
  };

  return (
    <div
      className={`sa-card p-4 cursor-pointer transition-all hover:border-sa-accent/50 relative group ${
        stock.alertTriggered && !stock.alertDismissed ? 'alert-glow' : ''
      }`}
      onClick={() => {
        if (stock.alertTriggered) {
          dismissAlert(stock.ticker);
        } else if (!showTargetInput && !showSmartAlert) {
          onExpand();
        }
      }}
    >
      {/* Alert badge */}
      {stock.alertTriggered && !stock.alertDismissed && (
        <div className="absolute -top-2 -right-2 bg-sa-alert text-white text-[10px] font-bold px-2 py-0.5 rounded-full alert-bounce flex items-center gap-1">
          <Bell className="w-3 h-3" />
          {t('alertTriggered')}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-sm font-bold text-sa-text">{stock.ticker}</span>
          <span className="text-xs text-sa-text-secondary ml-2 truncate max-w-[120px] inline-block align-middle">{stock.name}</span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onExpand(); }}
            className="p-1 hover:bg-sa-bg rounded"
          >
            <Maximize2 className="w-3 h-3 text-sa-text-secondary" />
          </button>
          <button onClick={handleRemove} className="p-1 hover:bg-sa-bg rounded">
            <X className="w-3 h-3 text-sa-text-secondary" />
          </button>
        </div>
      </div>

      {/* Price */}
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-xl font-bold text-sa-text">
          {(stock.ticker.endsWith('.KS') || stock.ticker.endsWith('.KQ')) ? '₩' + Math.round(price).toLocaleString() : '$' + price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span className={`text-xs font-medium ${isUp ? 'text-sa-up' : 'text-sa-down'}`}>
          {isUp ? '+' : ''}{change.toFixed(2)} ({isUp ? '+' : ''}{changePercent.toFixed(2)}%)
        </span>
      </div>

      {/* Chart canvas */}
      {historyData.length === 0 ? (
        <div className="w-full h-20 mb-2 bg-sa-border/20 rounded animate-pulse" />
      ) : (
        <canvas ref={canvasRef} className="w-full h-20 mb-2" />
      )}

      {/* Target price */}
      {stock.targetPrice && !showTargetInput && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-sa-alert">
            {t('targetPrice')}: ${stock.targetPrice.toFixed(2)}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); setTargetPrice(stock.ticker, undefined); }}
            className="text-sa-text-secondary hover:text-sa-alert"
          >
            {t('removeTarget')}
          </button>
        </div>
      )}

      {/* Target input */}
      {!stock.targetPrice && !showTargetInput && (
        <button
          onClick={(e) => { e.stopPropagation(); setShowTargetInput(true); }}
          className="text-xs text-sa-text-secondary hover:text-sa-accent w-full text-left"
        >
          + {t('setTarget')}
        </button>
      )}

      {showTargetInput && (
        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
          <input
            type="number"
            value={targetInput}
            onChange={(e) => setTargetInput(e.target.value)}
            placeholder={t('targetPrice')}
            className="flex-1 bg-sa-bg border border-sa-border rounded px-2 py-1 text-xs text-sa-text outline-none focus:border-sa-accent"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleSetTarget()}
          />
          <button onClick={handleSetTarget} className="text-xs text-sa-accent font-medium">
            {t('setTarget')}
          </button>
        </div>
      )}

      {/* Smart Alert */}
      {!showSmartAlert && !stock.smartAlert && (
        <button
          onClick={(e) => { e.stopPropagation(); setShowSmartAlert(true); }}
          className="text-xs text-sa-accent/60 hover:text-sa-accent mt-1"
        >
          + AI Alert
        </button>
      )}

      {stock.smartAlert && !showSmartAlert && (
        <div className="flex items-center justify-between text-xs mt-1">
          <span className="text-sa-accent/80 truncate flex-1">🤖 {stock.smartAlert}</span>
          <button
            onClick={(e) => { e.stopPropagation(); setSmartAlert(stock.ticker, undefined); }}
            className="text-sa-text-secondary hover:text-sa-alert ml-1"
          >
            ✕
          </button>
        </div>
      )}

      {showSmartAlert && (
        <div className="flex gap-2 mt-1" onClick={e => e.stopPropagation()}>
          <input
            type="text"
            value={smartAlertInput}
            onChange={(e) => setSmartAlertInput(e.target.value)}
            placeholder="e.g. when price drops 3%"
            className="flex-1 bg-sa-bg border border-sa-border rounded px-2 py-1 text-xs text-sa-text outline-none focus:border-sa-accent"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && smartAlertInput.trim()) {
                setSmartAlert(stock.ticker, smartAlertInput.trim());
                setShowSmartAlert(false);
                setSmartAlertInput('');
              }
            }}
          />
          <button
            onClick={() => {
              if (smartAlertInput.trim()) {
                setSmartAlert(stock.ticker, smartAlertInput.trim());
                setShowSmartAlert(false);
                setSmartAlertInput('');
              }
            }}
            className="text-xs text-sa-accent"
          >
            Set
          </button>
        </div>
      )}

      {/* Market status */}
      {priceData && !priceData.marketOpen && (
        <div className="text-[10px] text-sa-text-secondary mt-1">{t('marketClosed')}</div>
      )}
    </div>
  );
}
