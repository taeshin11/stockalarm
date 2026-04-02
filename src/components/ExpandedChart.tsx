'use client';

import { useState, useEffect, useRef } from 'react';
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

const EXTENDED_RANGES: Record<string, string> = {
  '1D': '5d',
  '1W': '1mo',
  '1M': '6mo',
  '3M': '1y',
  '1Y': '5y',
};

// Currency helper
function getCurrencySymbol(ticker: string): string {
  if (ticker.endsWith('.KS') || ticker.endsWith('.KQ')) return '₩';
  if (ticker.endsWith('.T')) return '¥';
  if (ticker.endsWith('.HK')) return 'HK$';
  if (ticker.endsWith('.L')) return '£';
  if (ticker.endsWith('.DE') || ticker.endsWith('.PA')) return '€';
  if (ticker.endsWith('.SZ') || ticker.endsWith('.SS')) return '¥';
  return '$';
}

function formatPrice(value: number, currency: string): string {
  if (currency === '₩') return currency + Math.round(value).toLocaleString();
  return currency + value.toFixed(2);
}

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
  const [showMAControls, setShowMAControls] = useState(false);
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Use state instead of ref so React tracks changes properly
  const [allData, setAllData] = useState<HistoricalDataPoint[]>([]);
  const [viewStart, setViewStart] = useState(0);
  const [viewCount, setViewCount] = useState(0);

  // Drag state via refs (don't need re-render)
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, viewStart: 0 });
  const pinchStartRef = useRef({ dist: 0, viewCount: 0 });
  // Keep latest viewStart/viewCount in refs for event handlers
  const viewRef = useRef({ start: 0, count: 0, total: 0 });

  const curr = getCurrencySymbol(ticker);

  useEffect(() => {
    setShowMAControls(window.innerWidth >= 640);
  }, []);

  // Load data
  useEffect(() => {
    setLoading(true);
    fetchHistoricalData(ticker, range).then(data => {
      setHistoryData(data);
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

  // Merge data
  useEffect(() => {
    const merged = extendedData.length > historyData.length ? extendedData : historyData;
    setAllData(merged);
    const defaultCount = Math.min(historyData.length || merged.length, merged.length);
    const count = defaultCount > 0 ? defaultCount : merged.length;
    const start = Math.max(0, merged.length - count);
    setViewCount(count);
    setViewStart(start);
    viewRef.current = { start, count, total: merged.length };
  }, [historyData, extendedData]);

  // Keep ref in sync
  useEffect(() => {
    viewRef.current = { start: viewStart, count: viewCount, total: allData.length };
  }, [viewStart, viewCount, allData.length]);

  const clampAndSet = (start: number, count: number) => {
    const total = viewRef.current.total;
    const c = Math.max(10, Math.min(count, total));
    const s = Math.max(0, Math.min(start, total - c));
    setViewStart(s);
    setViewCount(c);
  };

  const handleZoom = (factor: number) => {
    const { start, count } = viewRef.current;
    const newCount = Math.round(count * factor);
    const center = start + count / 2;
    const newStart = Math.round(center - newCount / 2);
    clampAndSet(newStart, newCount);
  };

  const handleReset = () => {
    const total = viewRef.current.total;
    const defaultCount = historyData.length || total;
    clampAndSet(Math.max(0, total - defaultCount), defaultCount);
  };

  // Pointer events for drag — use native events to avoid stale closures
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onPointerDown = (e: PointerEvent) => {
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.clientX, viewStart: viewRef.current.start };
      canvas.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const pxPerBar = canvas.getBoundingClientRect().width / viewRef.current.count;
      const barShift = Math.round(-dx / pxPerBar);
      const newStart = dragStartRef.current.viewStart + barShift;
      clampAndSet(newStart, viewRef.current.count);
    };

    const onPointerUp = () => {
      isDraggingRef.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const centerRatio = (e.clientX - rect.left) / rect.width;
      const factor = e.deltaY > 0 ? 1.15 : 0.87;
      const { start, count } = viewRef.current;
      const newCount = Math.round(count * factor);
      const centerIdx = start + count * centerRatio;
      const newStart = Math.round(centerIdx - newCount * centerRatio);
      clampAndSet(newStart, newCount);
    };

    let pinchDist = 0;
    let pinchCount = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchDist = Math.sqrt(dx * dx + dy * dy);
        pinchCount = viewRef.current.count;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchDist > 0) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const scale = pinchDist / dist;
        const newCount = Math.round(pinchCount * scale);
        const { start, count } = viewRef.current;
        clampAndSet(start + Math.round((count - newCount) / 2), newCount);
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
    };
  }, [allData]); // re-attach when data changes

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

    const visibleData = allData.slice(viewStart, viewStart + viewCount);
    const n = visibleData.length;
    if (n < 2) return;

    const closePrices = visibleData.map(d => d.close);
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

    // Grid
    ctx.strokeStyle = '#2a2f3e';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = chartTop + (i / 4) * chartH;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText(formatPrice(maxP - (i / 4) * rangeP, curr), 4, y - 3);
    }

    // Date labels
    ctx.fillStyle = '#64748b';
    ctx.font = '9px Inter, sans-serif';
    const labelInterval = Math.max(1, Math.floor(n / 6));
    for (let i = 0; i < n; i += labelInterval) {
      const x = ((i + 0.5) / n) * w;
      const dateStr = visibleData[i].time.length > 10 ? visibleData[i].time.slice(11, 16) : visibleData[i].time.slice(5);
      ctx.fillText(dateStr, x - 15, chartBottom + 12);
    }

    const candleSpacing = w / n;
    const candleW = Math.max(1, Math.min(candleSpacing * 0.6, 20));

    // MA lines
    for (const period of MA_PERIODS) {
      if (!activeMAs.has(period)) continue;
      const maData = calculateMA(allClosePrices, period);
      ctx.beginPath();
      ctx.strokeStyle = MA_COLORS[period];
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.8;
      let started = false;
      for (let i = 0; i < n; i++) {
        const val = maData[viewStart + i];
        if (val === null || val === undefined) continue;
        if (val < minP * 0.95 || val > maxP * 1.05) continue;
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

        ctx.beginPath();
        ctx.moveTo(x, priceToY(high));
        ctx.lineTo(x, priceToY(low));
        ctx.stroke();

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
      const isUpLine = closePrices[closePrices.length - 1] >= closePrices[0];
      ctx.beginPath();
      ctx.strokeStyle = isUpLine ? '#4ade80' : '#f87171';
      ctx.lineWidth = 2;
      closePrices.forEach((p, i) => {
        const x = ((i + 0.5) / n) * w;
        const y = priceToY(p);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      const gradient = ctx.createLinearGradient(0, 0, 0, chartBottom);
      gradient.addColorStop(0, isUpLine ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)');
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
      const targetY = inRange ? priceToY(targetPrice) : targetPrice > maxP ? chartTop + 4 : chartBottom - 4;
      ctx.beginPath();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.moveTo(0, targetY);
      ctx.lineTo(w, targetY);
      ctx.stroke();
      ctx.setLineDash([]);
      const arrow = targetPrice > maxP ? ' ↑' : targetPrice < minP ? ' ↓' : '';
      const label = `Target: ${formatPrice(targetPrice, curr)}${arrow}`;
      ctx.font = 'bold 11px Inter, sans-serif';
      const tw = ctx.measureText(label).width;
      const lx = w - tw - 10;
      const ly = targetPrice > maxP ? targetY + 14 : targetY - 5;
      ctx.fillStyle = 'rgba(239,68,68,0.15)';
      ctx.fillRect(lx - 4, ly - 12, tw + 8, 16);
      ctx.fillStyle = '#ef4444';
      ctx.fillText(label, lx, ly);
    }

    // Volume
    const volTop = chartBottom + 18;
    const volH = h - volTop - 2;
    const maxVol = Math.max(...visibleData.map(d => d.volume));
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
      const thumbX = barX + (totalW - thumbW) * (viewStart / Math.max(1, allData.length - viewCount));
      ctx.fillStyle = '#2a2f3e';
      ctx.fillRect(barX, barY, totalW, 2);
      ctx.fillStyle = '#60a5fa';
      ctx.fillRect(thumbX, barY, Math.max(thumbW, 4), 2);
    }
  }, [allData, viewStart, viewCount, stock?.targetPrice, activeMAs, chartType, curr]);

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
              <div className="text-2xl font-bold text-sa-text">{formatPrice(price, curr)}</div>
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
          <div className="flex bg-sa-bg rounded-lg p-0.5">
            <button onClick={() => setChartType('candle')} className={`p-1.5 rounded transition-colors ${chartType === 'candle' ? 'bg-sa-accent text-white' : 'text-sa-text-secondary hover:text-sa-text'}`}><BarChart3 className="w-4 h-4" /></button>
            <button onClick={() => setChartType('line')} className={`p-1.5 rounded transition-colors ${chartType === 'line' ? 'bg-sa-accent text-white' : 'text-sa-text-secondary hover:text-sa-text'}`}><TrendingUp className="w-4 h-4" /></button>
          </div>
          <div className="w-px h-5 bg-sa-border" />
          <div className="flex gap-1">
            {['1D', '1W', '1M', '3M', '1Y'].map(r => (
              <button key={r} onClick={() => setRange(r)} className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${range === r ? 'bg-sa-accent text-white' : 'bg-sa-bg text-sa-text-secondary hover:text-sa-text'}`}>{tTime(r)}</button>
            ))}
          </div>
          <div className="w-px h-5 bg-sa-border" />
          <div className="flex items-center gap-1">
            <button onClick={() => setShowMAControls(v => !v)} className={`flex items-center gap-0.5 px-2 py-1 rounded text-xs font-medium transition-colors ${showMAControls ? 'bg-sa-accent text-white' : 'bg-sa-bg text-sa-text-secondary hover:text-sa-text'}`}>
              MA <ChevronDown className={`w-3 h-3 transition-transform ${showMAControls ? 'rotate-180' : ''}`} />
            </button>
            {showMAControls && MA_PERIODS.map(period => (
              <button key={period} onClick={() => toggleMA(period)} className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${activeMAs.has(period) ? 'text-white' : 'bg-sa-bg text-sa-text-secondary hover:text-sa-text'}`} style={activeMAs.has(period) ? { backgroundColor: MA_COLORS[period] } : undefined}>MA{period}</button>
            ))}
          </div>
        </div>

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
        <div className="relative mb-3">
          {loading && (
            <div className="absolute inset-0 z-10 bg-sa-card/80 rounded-lg">
              <div className="w-full h-full animate-pulse bg-gradient-to-r from-sa-bg via-sa-border/30 to-sa-bg rounded-lg" />
            </div>
          )}
          <div className="absolute top-2 right-2 z-10 flex gap-1 bg-black/40 backdrop-blur-sm rounded-lg p-1">
            <button onClick={() => handleZoom(0.7)} className="p-1.5 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors" title="Zoom In"><ZoomIn className="w-3.5 h-3.5" /></button>
            <button onClick={() => handleZoom(1.4)} className="p-1.5 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors" title="Zoom Out"><ZoomOut className="w-3.5 h-3.5" /></button>
            <button onClick={handleReset} className="p-1.5 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors" title="Reset"><RotateCcw className="w-3.5 h-3.5" /></button>
          </div>
          <canvas ref={canvasRef} className="w-full h-64 sm:h-80 cursor-grab active:cursor-grabbing touch-none" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {[
            { label: t('high'), value: priceData?.high ? formatPrice(priceData.high, curr) : '\u2014' },
            { label: t('low'), value: priceData?.low ? formatPrice(priceData.low, curr) : '\u2014' },
            { label: t('volume'), value: priceData?.volume?.toLocaleString() || '\u2014' },
            { label: t('marketClosed'), value: priceData?.marketOpen ? 'Open' : 'Closed' },
          ].map(stat => (
            <div key={stat.label} className="bg-sa-bg rounded-lg px-3 py-2">
              <div className="text-[10px] text-sa-text-secondary uppercase">{stat.label}</div>
              <div className="text-sm font-medium text-sa-text">{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Target */}
        <div className="flex items-center gap-2">
          <input type="number" value={targetInput} onChange={e => setTargetInput(e.target.value)} placeholder={t('targetPrice')} className="flex-1 min-w-0 bg-sa-bg border border-sa-border rounded-lg px-3 py-2 text-sm text-sa-text outline-none focus:border-sa-accent" onKeyDown={e => e.key === 'Enter' && handleSetTarget()} />
          <button onClick={handleSetTarget} className="sa-btn-primary whitespace-nowrap flex-shrink-0">{t('setTarget')}</button>
          {stock.targetPrice && <button onClick={() => setTargetPrice(ticker, undefined)} className="sa-btn-secondary text-sa-alert whitespace-nowrap flex-shrink-0">{t('removeTarget')}</button>}
        </div>
        {stock.targetPrice && (
          <div className="mt-2 text-xs text-sa-alert flex items-center gap-1">
            <span className="w-4 h-0 inline-block" style={{ borderTop: '1.5px dashed #ef4444' }} />
            {t('targetPrice')}: {formatPrice(stock.targetPrice, curr)}
            {priceData && <span className="text-sa-text-secondary ml-1">({((stock.targetPrice - priceData.price) / priceData.price * 100).toFixed(1)}%)</span>}
          </div>
        )}
      </div>
    </div>
  );
}
