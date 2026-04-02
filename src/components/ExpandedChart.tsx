'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { X, BarChart3, TrendingUp, ZoomIn, ZoomOut, RotateCcw, ChevronDown } from 'lucide-react';
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
    if (i < period - 1) result.push(null);
    else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += data[j];
      result.push(sum / period);
    }
  }
  return result;
}

// Longer history ranges for scroll-back
const EXTENDED_RANGES: Record<string, string> = {
  '1D': '5d',
  '1W': '1mo',
  '1M': '6mo',
  '3M': '1y',
  '1Y': '5y',
};

export default function ExpandedChart({ ticker, onClose }: ExpandedChartProps) {
  const t = useTranslations('chart');
  const tTime = useTranslations('time');
  const { stocks, prices, setTargetPrice } = useWatchlistStore();
  const stock = stocks.find(s => s.ticker === ticker);
  const priceData = prices[ticker];
  const [range, setRange] = useState('1M');
  const [historyData, setHistoryData] = useState<HistoricalDataPoint[]>([]);
  const [extendedData, setExtendedData] = useState<HistoricalDataPoint[]>([]);
  const [targetInput, setTargetInput] = useState(stock?.targetPrice?.toString() || '');
  const [activeMAs, setActiveMAs] = useState<Set<number>>(new Set([5, 20]));
  const [chartType, setChartType] = useState<'candle' | 'line'>('candle');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showMAControls, setShowMAControls] = useState(false);
  const [loading, setLoading] = useState(false);

  // Default MA controls visible on desktop
  useEffect(() => {
    setShowMAControls(window.innerWidth >= 640);
  }, []);

  // Viewport state: which slice of data is visible
  const [viewStart, setViewStart] = useState(0); // index of first visible bar
  const [viewCount, setViewCount] = useState(0); // number of visible bars
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, viewStart: 0 });
  const pinchStartRef = useRef({ dist: 0, viewCount: 0 });
  const allDataRef = useRef<HistoricalDataPoint[]>([]);

  // Load primary data
  useEffect(() => {
    setLoading(true);
    fetchHistoricalData(ticker, range).then(data => {
      setHistoryData(data);
      // Also fetch extended data for scroll-back
      const extRange = EXTENDED_RANGES[range];
      if (extRange) {
        fetchHistoricalData(ticker, extRange).then(ext => {
          setExtendedData(ext);
          setLoading(false);
        }).catch(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }).catch(() => setLoading(false));
  }, [ticker, range]);

  // Merge extended + primary data (extended has older data)
  useEffect(() => {
    let merged: HistoricalDataPoint[];
    if (extendedData.length > historyData.length) {
      merged = extendedData;
    } else {
      merged = historyData;
    }
    allDataRef.current = merged;
    // Default view: show the last N bars (same as original range)
    const defaultCount = Math.min(historyData.length, merged.length);
    setViewCount(defaultCount > 0 ? defaultCount : merged.length);
    setViewStart(Math.max(0, merged.length - (defaultCount > 0 ? defaultCount : merged.length)));
  }, [historyData, extendedData]);

  const allData = allDataRef.current;
  const minViewCount = 10;
  const maxViewCount = allData.length;

  // Clamp helpers
  const clampView = useCallback((start: number, count: number) => {
    const c = Math.max(minViewCount, Math.min(count, maxViewCount));
    const s = Math.max(0, Math.min(start, allData.length - c));
    return { start: s, count: c };
  }, [allData.length, maxViewCount]);

  // Zoom in/out
  const zoom = useCallback((factor: number, centerRatio = 0.5) => {
    const newCount = Math.round(viewCount * factor);
    const centerIdx = viewStart + viewCount * centerRatio;
    const newStart = Math.round(centerIdx - newCount * centerRatio);
    const clamped = clampView(newStart, newCount);
    setViewStart(clamped.start);
    setViewCount(clamped.count);
  }, [viewCount, viewStart, clampView]);

  const resetView = useCallback(() => {
    const defaultCount = historyData.length || allData.length;
    setViewCount(defaultCount);
    setViewStart(Math.max(0, allData.length - defaultCount));
  }, [historyData.length, allData.length]);

  // Mouse/touch handlers for pan and pinch
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, viewStart };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [viewStart]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dx = e.clientX - dragStartRef.current.x;
    const pxPerBar = canvas.getBoundingClientRect().width / viewCount;
    const barShift = Math.round(-dx / pxPerBar);
    const newStart = dragStartRef.current.viewStart + barShift;
    const clamped = clampView(newStart, viewCount);
    setViewStart(clamped.start);
  }, [isDragging, viewCount, clampView]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const centerRatio = (e.clientX - rect.left) / rect.width;
    const factor = e.deltaY > 0 ? 1.15 : 0.87;
    zoom(factor, centerRatio);
  }, [zoom]);

  // Touch pinch zoom
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartRef.current = { dist: Math.sqrt(dx * dx + dy * dy), viewCount };
    }
  }, [viewCount]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const scale = pinchStartRef.current.dist / dist;
      const newCount = Math.round(pinchStartRef.current.viewCount * scale);
      const clamped = clampView(viewStart + Math.round((viewCount - newCount) / 2), newCount);
      setViewStart(clamped.start);
      setViewCount(clamped.count);
    }
  }, [viewStart, viewCount, clampView]);

  const toggleMA = (period: number) => {
    setActiveMAs(prev => {
      const next = new Set(prev);
      if (next.has(period)) next.delete(period);
      else next.add(period);
      return next;
    });
  };

  // === DRAW CHART ===
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || allData.length < 2 || viewCount < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    // Visible slice
    const visibleData = allData.slice(viewStart, viewStart + viewCount);
    const n = visibleData.length;
    if (n < 2) return;

    const closePrices = visibleData.map(d => d.close);
    // Use all close prices for MA calculation (not just visible)
    const allClosePrices = allData.map(d => d.close);

    const allLows = visibleData.map(d => d.low || d.close).filter(v => v > 0);
    const allHighs = visibleData.map(d => d.high || d.close).filter(v => v > 0);
    const minP = Math.min(...allLows, ...closePrices);
    const maxP = Math.max(...allHighs, ...closePrices);
    const targetPrice = stock?.targetPrice;
    const rangeP = maxP - minP || 1;

    const chartTop = 8;
    const chartBottom = h * 0.85;
    const chartH = chartBottom - chartTop;

    const priceToY = (p: number) => chartBottom - ((p - minP) / rangeP) * chartH;

    ctx.clearRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = '#2a2f3e';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = chartTop + (i / 4) * chartH;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText('$' + (maxP - (i / 4) * rangeP).toFixed(2), 4, y - 3);
    }

    // Date labels at bottom of chart area
    ctx.fillStyle = '#64748b';
    ctx.font = '9px Inter, sans-serif';
    const labelInterval = Math.max(1, Math.floor(n / 6));
    for (let i = 0; i < n; i += labelInterval) {
      const x = ((i + 0.5) / n) * w;
      const d = visibleData[i];
      const dateStr = d.time.length > 10 ? d.time.slice(11, 16) : d.time.slice(5);
      ctx.fillText(dateStr, x - 15, chartBottom + 12);
    }

    const candleSpacing = w / n;
    const candleW = Math.max(1, Math.min(candleSpacing * 0.6, 20));

    // Moving Averages (calculated from all data, drawn for visible portion)
    for (const period of MA_PERIODS) {
      if (!activeMAs.has(period)) continue;
      const maData = calculateMA(allClosePrices, period);
      ctx.beginPath();
      ctx.strokeStyle = MA_COLORS[period];
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.8;
      let started = false;
      for (let i = 0; i < n; i++) {
        const dataIdx = viewStart + i;
        const val = maData[dataIdx];
        if (val === null || val === undefined) continue;
        if (val < minP * 0.95 || val > maxP * 1.05) continue; // skip if way out of range
        const x = ((i + 0.5) / n) * w;
        const y = priceToY(val);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    if (chartType === 'candle') {
      visibleData.forEach((d, i) => {
        const x = ((i + 0.5) / n) * w;
        const open = d.open || d.close;
        const close = d.close;
        const high = d.high || Math.max(open, close);
        const low = d.low || Math.min(open, close);
        const bullish = close >= open;

        const bodyTop = priceToY(Math.max(open, close));
        const bodyBot = priceToY(Math.min(open, close));
        const bodyH = Math.max(1, bodyBot - bodyTop);

        ctx.strokeStyle = bullish ? '#4ade80' : '#f87171';
        ctx.fillStyle = bullish ? '#4ade80' : '#f87171';
        ctx.lineWidth = 1;

        // Wick
        ctx.beginPath();
        ctx.moveTo(x, priceToY(high));
        ctx.lineTo(x, priceToY(low));
        ctx.stroke();

        // Body
        if (bodyH <= 1) {
          ctx.beginPath();
          ctx.moveTo(x - candleW / 2, bodyTop);
          ctx.lineTo(x + candleW / 2, bodyTop);
          ctx.stroke();
        } else {
          ctx.fillRect(x - candleW / 2, bodyTop, candleW, bodyH);
        }
      });
    } else {
      const isUp = closePrices[closePrices.length - 1] >= closePrices[0];
      ctx.beginPath();
      ctx.strokeStyle = isUp ? '#4ade80' : '#f87171';
      ctx.lineWidth = 2;
      closePrices.forEach((p, i) => {
        const x = ((i + 0.5) / n) * w;
        const y = priceToY(p);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      const gradient = ctx.createLinearGradient(0, 0, 0, chartBottom);
      gradient.addColorStop(0, isUp ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.lineTo(((n - 0.5) / n) * w, chartBottom);
      ctx.lineTo((0.5 / n) * w, chartBottom);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    // Target line
    if (targetPrice) {
      const inRange = targetPrice >= minP && targetPrice <= maxP;
      let targetY: number;
      if (inRange) targetY = priceToY(targetPrice);
      else if (targetPrice > maxP) targetY = chartTop + 4;
      else targetY = chartBottom - 4;

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
      const textW = ctx.measureText(label).width;
      const lx = w - textW - 10;
      const ly = targetPrice > maxP ? targetY + 14 : targetY - 5;
      ctx.fillStyle = 'rgba(239,68,68,0.15)';
      ctx.fillRect(lx - 4, ly - 12, textW + 8, 16);
      ctx.fillStyle = '#ef4444';
      ctx.fillText(label, lx, ly);
    }

    // Volume bars
    const volTop = chartBottom + 18;
    const volH = h - volTop - 2;
    const volumes = visibleData.map(d => d.volume);
    const maxVol = Math.max(...volumes);
    if (maxVol > 0 && volH > 5) {
      visibleData.forEach((d, i) => {
        const x = ((i + 0.5) / n) * w;
        const barH = (d.volume / maxVol) * volH;
        ctx.fillStyle = d.close >= (d.open || d.close) ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)';
        ctx.fillRect(x - candleW / 2, h - 2 - barH, candleW, barH);
      });
    }

    // Scroll indicator
    if (allData.length > viewCount) {
      const barY = h - 1;
      const totalW = w * 0.3;
      const barX = w * 0.35;
      const thumbW = totalW * (viewCount / allData.length);
      const thumbX = barX + (totalW - thumbW) * (viewStart / (allData.length - viewCount));
      ctx.fillStyle = '#2a2f3e';
      ctx.fillRect(barX, barY, totalW, 2);
      ctx.fillStyle = '#60a5fa';
      ctx.fillRect(thumbX, barY, Math.max(thumbW, 4), 2);
    }
  }, [allData, viewStart, viewCount, stock?.targetPrice, activeMAs, chartType]);

  const handleSetTarget = () => {
    const value = parseFloat(targetInput);
    if (!isNaN(value) && value > 0) setTargetPrice(ticker, value);
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

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {/* Chart type */}
          <div className="flex bg-sa-bg rounded-lg p-0.5">
            <button onClick={() => setChartType('candle')} className={`p-1.5 rounded transition-colors ${chartType === 'candle' ? 'bg-sa-accent text-white' : 'text-sa-text-secondary hover:text-sa-text'}`} title="Candlestick">
              <BarChart3 className="w-4 h-4" />
            </button>
            <button onClick={() => setChartType('line')} className={`p-1.5 rounded transition-colors ${chartType === 'line' ? 'bg-sa-accent text-white' : 'text-sa-text-secondary hover:text-sa-text'}`} title="Line">
              <TrendingUp className="w-4 h-4" />
            </button>
          </div>
          <div className="w-px h-5 bg-sa-border" />

          {/* Time range */}
          <div className="flex gap-1">
            {['1D', '1W', '1M', '3M', '1Y'].map(r => (
              <button key={r} onClick={() => setRange(r)} className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${range === r ? 'bg-sa-accent text-white' : 'bg-sa-bg text-sa-text-secondary hover:text-sa-text'}`}>
                {tTime(r)}
              </button>
            ))}
          </div>
          <div className="w-px h-5 bg-sa-border" />

          {/* MA toggles — collapsible */}
          <div className="flex items-center gap-1">
            <button onClick={() => setShowMAControls(v => !v)} className={`flex items-center gap-0.5 px-2 py-1 rounded text-xs font-medium transition-colors ${showMAControls ? 'bg-sa-accent text-white' : 'bg-sa-bg text-sa-text-secondary hover:text-sa-text'}`}>
              MA <ChevronDown className={`w-3 h-3 transition-transform ${showMAControls ? 'rotate-180' : ''}`} />
            </button>
            {showMAControls && MA_PERIODS.map(period => (
              <button key={period} onClick={() => toggleMA(period)} className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${activeMAs.has(period) ? 'text-white' : 'bg-sa-bg text-sa-text-secondary hover:text-sa-text'}`} style={activeMAs.has(period) ? { backgroundColor: MA_COLORS[period] } : undefined}>
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

        {/* Chart Canvas — interactive, with zoom overlay */}
        <div className="relative mb-3">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-sa-card/80 rounded-lg">
              <div className="w-full h-full animate-pulse bg-gradient-to-r from-sa-bg via-sa-border/30 to-sa-bg rounded-lg" />
            </div>
          )}
          {/* Zoom controls overlay — top-right on canvas */}
          <div className="absolute top-2 right-2 z-10 flex gap-1 bg-black/40 backdrop-blur-sm rounded-lg p-1">
            <button onClick={() => zoom(0.7)} className="p-1.5 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors" title="Zoom In">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => zoom(1.4)} className="p-1.5 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors" title="Zoom Out">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button onClick={resetView} className="p-1.5 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors" title="Reset">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
          <canvas
            ref={canvasRef}
            className="w-full h-64 sm:h-80 cursor-grab active:cursor-grabbing touch-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {[
            { label: t('high'), value: `$${priceData?.high?.toFixed(2) || '\u2014'}` },
            { label: t('low'), value: `$${priceData?.low?.toFixed(2) || '\u2014'}` },
            { label: t('volume'), value: priceData?.volume?.toLocaleString() || '\u2014' },
            { label: t('marketClosed'), value: priceData?.marketOpen ? 'Open' : 'Closed' },
          ].map(stat => (
            <div key={stat.label} className="bg-sa-bg rounded-lg px-3 py-2">
              <div className="text-[10px] text-sa-text-secondary uppercase">{stat.label}</div>
              <div className="text-sm font-medium text-sa-text">{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Target price */}
        <div className="flex items-center gap-2">
          <input type="number" value={targetInput} onChange={e => setTargetInput(e.target.value)} placeholder={t('targetPrice')} className="flex-1 min-w-0 bg-sa-bg border border-sa-border rounded-lg px-3 py-2 text-sm text-sa-text outline-none focus:border-sa-accent" onKeyDown={e => e.key === 'Enter' && handleSetTarget()} />
          <button onClick={handleSetTarget} className="sa-btn-primary whitespace-nowrap flex-shrink-0">{t('setTarget')}</button>
          {stock.targetPrice && (
            <button onClick={() => setTargetPrice(ticker, undefined)} className="sa-btn-secondary text-sa-alert whitespace-nowrap flex-shrink-0">{t('removeTarget')}</button>
          )}
        </div>
        {stock.targetPrice && (
          <div className="mt-2 text-xs text-sa-alert flex items-center gap-1">
            <span className="w-4 h-0 inline-block" style={{ borderTop: '1.5px dashed #ef4444' }} />
            {t('targetPrice')}: ${stock.targetPrice.toFixed(2)}
            {priceData && <span className="text-sa-text-secondary ml-1">({((stock.targetPrice - priceData.price) / priceData.price * 100).toFixed(1)}%)</span>}
          </div>
        )}
      </div>
    </div>
  );
}
