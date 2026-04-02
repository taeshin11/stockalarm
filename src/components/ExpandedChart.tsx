'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { X, BarChart3, TrendingUp, ZoomIn, ZoomOut, RotateCcw, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { useWatchlistStore } from '@/store/useWatchlistStore';
import { fetchHistoricalData, HistoricalDataPoint } from '@/lib/stockApi';

interface ExpandedChartProps {
  ticker: string;
  onClose: () => void;
}

// --- Indicator types ---
interface Indicator {
  id: string;
  type: 'SMA' | 'EMA' | 'WMA';
  period: number;
  color: string;
}

const INDICATOR_COLORS = ['#f59e0b', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899', '#10b981', '#ef4444', '#6366f1'];

function calculateSMA(data: number[], period: number): (number | null)[] {
  const r: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { r.push(null); continue; }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += data[j];
    r.push(sum / period);
  }
  return r;
}

function calculateEMA(data: number[], period: number): (number | null)[] {
  const r: (number | null)[] = [];
  const k = 2 / (period + 1);
  let ema: number | null = null;
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { r.push(null); continue; }
    if (ema === null) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += data[j];
      ema = sum / period;
    } else {
      ema = data[i] * k + ema * (1 - k);
    }
    r.push(ema);
  }
  return r;
}

function calculateWMA(data: number[], period: number): (number | null)[] {
  const r: (number | null)[] = [];
  const denom = (period * (period + 1)) / 2;
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { r.push(null); continue; }
    let sum = 0;
    for (let j = 0; j < period; j++) sum += data[i - period + 1 + j] * (j + 1);
    r.push(sum / denom);
  }
  return r;
}

function calcIndicator(data: number[], ind: Indicator): (number | null)[] {
  switch (ind.type) {
    case 'EMA': return calculateEMA(data, ind.period);
    case 'WMA': return calculateWMA(data, ind.period);
    default: return calculateSMA(data, ind.period);
  }
}

const EXTENDED_RANGES: Record<string, string> = {
  '1D': '1mo', '1W': '3mo', '1M': '1y', '3M': '2y', '1Y': '10y',
};

function getCurrency(ticker: string): string {
  if (ticker.endsWith('.KS') || ticker.endsWith('.KQ')) return '₩';
  if (ticker.endsWith('.T')) return '¥';
  if (ticker.endsWith('.HK')) return 'HK$';
  if (ticker.endsWith('.L')) return '£';
  if (ticker.endsWith('.DE') || ticker.endsWith('.PA')) return '€';
  return '$';
}

function fmtPrice(v: number, c: string): string {
  return c === '₩' ? c + Math.round(v).toLocaleString() : c + v.toFixed(2);
}

// Default indicators (TradingView-like defaults)
const DEFAULT_INDICATORS: Indicator[] = [
  { id: '1', type: 'SMA', period: 5, color: '#f59e0b' },
  { id: '2', type: 'SMA', period: 20, color: '#06b6d4' },
];

export default function ExpandedChart({ ticker, onClose }: ExpandedChartProps) {
  const t = useTranslations('chart');
  const tTime = useTranslations('time');
  const { stocks, prices, setTargetPrice } = useWatchlistStore();
  const stock = stocks.find(s => s.ticker === ticker);
  const priceData = prices[ticker];
  const curr = getCurrency(ticker);

  const [range, setRange] = useState('3M'); // default 3M so MA100/200 can show
  const [allData, setAllData] = useState<HistoricalDataPoint[]>([]);
  const [defaultDataLen, setDefaultDataLen] = useState(0);
  const [targetInput, setTargetInput] = useState(stock?.targetPrice?.toString() || '');
  const [indicators, setIndicators] = useState<Indicator[]>(DEFAULT_INDICATORS);
  const [chartType, setChartType] = useState<'candle' | 'line'>('candle');
  const [showIndicatorPanel, setShowIndicatorPanel] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newIndType, setNewIndType] = useState<'SMA' | 'EMA' | 'WMA'>('EMA');
  const [newIndPeriod, setNewIndPeriod] = useState('50');

  // View state
  const [vStart, setVStart] = useState(0);
  const [vCount, setVCount] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load data
  useEffect(() => {
    setLoading(true);
    const ext = EXTENDED_RANGES[range] || range;
    // Always fetch the extended range for more history
    Promise.all([
      fetchHistoricalData(ticker, range),
      fetchHistoricalData(ticker, ext),
    ]).then(([primary, extended]) => {
      const merged = extended.length > primary.length ? extended : primary;
      setAllData(merged);
      setDefaultDataLen(primary.length || merged.length);
      const count = primary.length || merged.length;
      setVCount(count);
      setVStart(Math.max(0, merged.length - count));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [ticker, range]);

  // --- Interaction via native events on canvas ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || allData.length < 2) return;

    let dragging = false;
    let startX = 0;
    let startVS = 0;

    const getView = () => ({ s: vStart, c: vCount, total: allData.length });

    const clamp = (s: number, c: number) => {
      const total = allData.length;
      const cc = Math.max(10, Math.min(c, total));
      const ss = Math.max(0, Math.min(s, total - cc));
      return { s: ss, c: cc };
    };

    const applyView = (s: number, c: number) => {
      const v = clamp(s, c);
      setVStart(v.s);
      setVCount(v.c);
    };

    const onDown = (e: PointerEvent) => {
      dragging = true;
      startX = e.clientX;
      startVS = vStart; // capture current
      canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
    };

    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const w = canvas.getBoundingClientRect().width;
      const barsPerPx = vCount / w;
      const shift = Math.round(-dx * barsPerPx);
      applyView(startVS + shift, vCount);
    };

    const onUp = () => { dragging = false; };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      const factor = e.deltaY > 0 ? 1.2 : 0.83;
      const newC = Math.round(vCount * factor);
      const center = vStart + vCount * ratio;
      const newS = Math.round(center - newC * ratio);
      applyView(newS, newC);
    };

    // Pinch
    let pinchDist = 0;
    let pinchC = 0;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchDist = Math.sqrt(dx * dx + dy * dy);
        pinchC = vCount;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchDist > 0) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const d = Math.sqrt(dx * dx + dy * dy);
        const newC = Math.round(pinchC * (pinchDist / d));
        applyView(vStart + Math.round((vCount - newC) / 2), newC);
      }
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
    };
  }, [allData, vStart, vCount]);

  // Zoom buttons
  const zoomIn = () => {
    const newC = Math.round(vCount * 0.7);
    const center = vStart + vCount / 2;
    setVCount(Math.max(10, newC));
    setVStart(Math.max(0, Math.min(Math.round(center - newC / 2), allData.length - newC)));
  };
  const zoomOut = () => {
    const newC = Math.round(vCount * 1.4);
    const c = Math.min(newC, allData.length);
    const center = vStart + vCount / 2;
    setVCount(c);
    setVStart(Math.max(0, Math.min(Math.round(center - c / 2), allData.length - c)));
  };
  const resetView = () => {
    const c = defaultDataLen || allData.length;
    setVCount(c);
    setVStart(Math.max(0, allData.length - c));
  };

  // Add indicator
  const addIndicator = () => {
    const p = parseInt(newIndPeriod);
    if (isNaN(p) || p < 1 || p > 500) return;
    const color = INDICATOR_COLORS[indicators.length % INDICATOR_COLORS.length];
    setIndicators([...indicators, { id: Date.now().toString(), type: newIndType, period: p, color }]);
  };

  const removeIndicator = (id: string) => {
    setIndicators(indicators.filter(i => i.id !== id));
  };

  // === DRAW ===
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || allData.length < 2 || vCount < 2) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;

    const vis = allData.slice(vStart, vStart + vCount);
    const n = vis.length;
    if (n < 2) return;

    const closes = vis.map(d => d.close);
    const allCloses = allData.map(d => d.close);
    const lows = vis.map(d => d.low || d.close).filter(v => v > 0);
    const highs = vis.map(d => d.high || d.close).filter(v => v > 0);
    const minP = Math.min(...lows, ...closes);
    const maxP = Math.max(...highs, ...closes);
    const rng = maxP - minP || 1;
    const cTop = 8, cBot = h * 0.84, cH = cBot - cTop;
    const p2y = (p: number) => cBot - ((p - minP) / rng) * cH;

    ctx.clearRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = '#2a2f3e'; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = cTop + (i / 4) * cH;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      ctx.fillStyle = '#94a3b8'; ctx.font = '10px Inter,sans-serif';
      ctx.fillText(fmtPrice(maxP - (i / 4) * rng, curr), 4, y - 3);
    }

    // Date labels
    ctx.fillStyle = '#64748b'; ctx.font = '9px Inter,sans-serif';
    const lbl = Math.max(1, Math.floor(n / 6));
    for (let i = 0; i < n; i += lbl) {
      const x = ((i + 0.5) / n) * w;
      const ds = vis[i].time.length > 10 ? vis[i].time.slice(5, 10) : vis[i].time.slice(5);
      ctx.fillText(ds, x - 15, cBot + 12);
    }

    const sp = w / n;
    const cw = Math.max(1, Math.min(sp * 0.6, 20));

    // Indicators
    for (const ind of indicators) {
      const maData = calcIndicator(allCloses, ind);
      ctx.beginPath(); ctx.strokeStyle = ind.color; ctx.lineWidth = 1.3; ctx.globalAlpha = 0.85;
      let started = false;
      for (let i = 0; i < n; i++) {
        const v = maData[vStart + i];
        if (v === null || v === undefined) continue;
        if (v < minP * 0.9 || v > maxP * 1.1) continue;
        const x = ((i + 0.5) / n) * w;
        const y = p2y(v);
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      }
      ctx.stroke(); ctx.globalAlpha = 1;
    }

    // Candles or line
    if (chartType === 'candle') {
      vis.forEach((d, i) => {
        const x = ((i + 0.5) / n) * w;
        const o = d.open || d.close, c = d.close;
        const hi = d.high || Math.max(o, c), lo = d.low || Math.min(o, c);
        const bull = c >= o;
        const bT = p2y(Math.max(o, c)), bB = p2y(Math.min(o, c));
        const bH = Math.max(1, bB - bT);
        ctx.strokeStyle = ctx.fillStyle = bull ? '#4ade80' : '#f87171';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, p2y(hi)); ctx.lineTo(x, p2y(lo)); ctx.stroke();
        if (bH <= 1) { ctx.beginPath(); ctx.moveTo(x - cw / 2, bT); ctx.lineTo(x + cw / 2, bT); ctx.stroke(); }
        else ctx.fillRect(x - cw / 2, bT, cw, bH);
      });
    } else {
      const up = closes[closes.length - 1] >= closes[0];
      ctx.beginPath(); ctx.strokeStyle = up ? '#4ade80' : '#f87171'; ctx.lineWidth = 2;
      closes.forEach((p, i) => { const x = ((i + 0.5) / n) * w; if (i === 0) ctx.moveTo(x, p2y(p)); else ctx.lineTo(x, p2y(p)); });
      ctx.stroke();
      const g = ctx.createLinearGradient(0, 0, 0, cBot);
      g.addColorStop(0, up ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.lineTo(((n - 0.5) / n) * w, cBot); ctx.lineTo((0.5 / n) * w, cBot);
      ctx.closePath(); ctx.fillStyle = g; ctx.fill();
    }

    // Target
    const tp = stock?.targetPrice;
    if (tp) {
      const inR = tp >= minP && tp <= maxP;
      const ty = inR ? p2y(tp) : tp > maxP ? cTop + 4 : cBot - 4;
      ctx.beginPath(); ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
      ctx.moveTo(0, ty); ctx.lineTo(w, ty); ctx.stroke(); ctx.setLineDash([]);
      const arr = tp > maxP ? ' ↑' : tp < minP ? ' ↓' : '';
      const lb = `Target: ${fmtPrice(tp, curr)}${arr}`;
      ctx.font = 'bold 11px Inter,sans-serif';
      const tw2 = ctx.measureText(lb).width;
      const lx = w - tw2 - 10, ly = tp > maxP ? ty + 14 : ty - 5;
      ctx.fillStyle = 'rgba(239,68,68,0.15)'; ctx.fillRect(lx - 4, ly - 12, tw2 + 8, 16);
      ctx.fillStyle = '#ef4444'; ctx.fillText(lb, lx, ly);
    }

    // Volume
    const vTop = cBot + 18, vH = h - vTop - 2;
    const maxV = Math.max(...vis.map(d => d.volume));
    if (maxV > 0 && vH > 5) {
      vis.forEach((d, i) => {
        const x = ((i + 0.5) / n) * w;
        const bh = (d.volume / maxV) * vH;
        ctx.fillStyle = d.close >= (d.open || d.close) ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)';
        ctx.fillRect(x - cw / 2, h - 2 - bh, cw, bh);
      });
    }

    // Scroll bar
    if (allData.length > vCount) {
      const bw = w * 0.3, bx = w * 0.35;
      const tw3 = bw * (vCount / allData.length);
      const tx = bx + (bw - tw3) * (vStart / Math.max(1, allData.length - vCount));
      ctx.fillStyle = '#2a2f3e'; ctx.fillRect(bx, h - 1, bw, 2);
      ctx.fillStyle = '#60a5fa'; ctx.fillRect(tx, h - 1, Math.max(tw3, 4), 2);
    }
  }, [allData, vStart, vCount, stock?.targetPrice, indicators, chartType, curr]);

  const handleSetTarget = () => {
    const v = parseFloat(targetInput);
    if (!isNaN(v) && v > 0) setTargetPrice(ticker, v);
  };

  if (!stock) return null;
  const price = priceData?.price ?? 0;
  const change = priceData?.change ?? 0;
  const changePct = priceData?.changePercent ?? 0;
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
              <div className="text-2xl font-bold text-sa-text">{fmtPrice(price, curr)}</div>
              <div className={`text-sm font-medium ${isUp ? 'text-sa-up' : 'text-sa-down'}`}>
                {isUp ? '+' : ''}{change.toFixed(2)} ({isUp ? '+' : ''}{changePct.toFixed(2)}%)
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-sa-bg rounded-lg"><X className="w-5 h-5 text-sa-text-secondary" /></button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="flex bg-sa-bg rounded-lg p-0.5">
            <button onClick={() => setChartType('candle')} className={`p-1.5 rounded ${chartType === 'candle' ? 'bg-sa-accent text-white' : 'text-sa-text-secondary hover:text-sa-text'}`}><BarChart3 className="w-4 h-4" /></button>
            <button onClick={() => setChartType('line')} className={`p-1.5 rounded ${chartType === 'line' ? 'bg-sa-accent text-white' : 'text-sa-text-secondary hover:text-sa-text'}`}><TrendingUp className="w-4 h-4" /></button>
          </div>
          <div className="w-px h-5 bg-sa-border" />
          <div className="flex gap-1">
            {['1D', '1W', '1M', '3M', '1Y'].map(r => (
              <button key={r} onClick={() => setRange(r)} className={`px-2.5 py-1 rounded text-xs font-medium ${range === r ? 'bg-sa-accent text-white' : 'bg-sa-bg text-sa-text-secondary hover:text-sa-text'}`}>{tTime(r)}</button>
            ))}
          </div>
          <div className="w-px h-5 bg-sa-border" />
          {/* Indicator toggle */}
          <button onClick={() => setShowIndicatorPanel(v => !v)} className={`flex items-center gap-0.5 px-2 py-1 rounded text-xs font-medium ${showIndicatorPanel ? 'bg-sa-accent text-white' : 'bg-sa-bg text-sa-text-secondary hover:text-sa-text'}`}>
            Indicators <ChevronDown className={`w-3 h-3 transition-transform ${showIndicatorPanel ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Indicator Panel — TradingView style */}
        {showIndicatorPanel && (
          <div className="sa-card p-3 mb-3 border border-sa-border">
            <div className="text-xs font-medium text-sa-text mb-2">Active Indicators</div>
            <div className="space-y-1 mb-3">
              {indicators.map(ind => (
                <div key={ind.id} className="flex items-center gap-2 text-xs">
                  <span className="w-3 h-[3px] rounded" style={{ backgroundColor: ind.color }} />
                  <span className="text-sa-text font-medium">{ind.type}</span>
                  <span className="text-sa-text-secondary">({ind.period})</span>
                  <button onClick={() => removeIndicator(ind.id)} className="ml-auto p-0.5 text-sa-text-secondary hover:text-sa-alert"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
              {indicators.length === 0 && <p className="text-xs text-sa-text-secondary">No indicators added</p>}
            </div>
            <div className="flex items-center gap-2">
              <select value={newIndType} onChange={e => setNewIndType(e.target.value as any)} className="bg-sa-bg border border-sa-border rounded px-2 py-1 text-xs text-sa-text outline-none">
                <option value="SMA">SMA</option>
                <option value="EMA">EMA</option>
                <option value="WMA">WMA</option>
              </select>
              <input type="number" value={newIndPeriod} onChange={e => setNewIndPeriod(e.target.value)} className="w-16 bg-sa-bg border border-sa-border rounded px-2 py-1 text-xs text-sa-text outline-none" placeholder="Period" />
              <button onClick={addIndicator} className="flex items-center gap-1 px-2 py-1 rounded bg-sa-accent text-white text-xs font-medium hover:bg-blue-500">
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            {/* Quick presets */}
            <div className="flex flex-wrap gap-1 mt-2">
              {[
                { label: 'EMA 9', type: 'EMA' as const, period: 9 },
                { label: 'SMA 20', type: 'SMA' as const, period: 20 },
                { label: 'EMA 50', type: 'EMA' as const, period: 50 },
                { label: 'SMA 100', type: 'SMA' as const, period: 100 },
                { label: 'SMA 200', type: 'SMA' as const, period: 200 },
                { label: 'EMA 12', type: 'EMA' as const, period: 12 },
                { label: 'EMA 26', type: 'EMA' as const, period: 26 },
              ].map(p => {
                const exists = indicators.some(i => i.type === p.type && i.period === p.period);
                return (
                  <button key={p.label} onClick={() => {
                    if (!exists) {
                      const color = INDICATOR_COLORS[indicators.length % INDICATOR_COLORS.length];
                      setIndicators(prev => [...prev, { id: Date.now().toString(), type: p.type, period: p.period, color }]);
                    }
                  }} disabled={exists} className={`px-2 py-0.5 rounded text-[10px] font-medium ${exists ? 'bg-sa-border/50 text-sa-text-secondary/50' : 'bg-sa-bg text-sa-text-secondary hover:text-sa-text hover:bg-sa-border'}`}>
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Active indicator legend */}
        {indicators.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-2 text-[10px]">
            {indicators.map(ind => (
              <span key={ind.id} className="flex items-center gap-1">
                <span className="w-3 h-[2px] rounded" style={{ backgroundColor: ind.color }} />
                <span className="text-sa-text-secondary">{ind.type}{ind.period}</span>
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
            <button onClick={zoomIn} className="p-1.5 rounded text-white/70 hover:text-white hover:bg-white/10"><ZoomIn className="w-3.5 h-3.5" /></button>
            <button onClick={zoomOut} className="p-1.5 rounded text-white/70 hover:text-white hover:bg-white/10"><ZoomOut className="w-3.5 h-3.5" /></button>
            <button onClick={resetView} className="p-1.5 rounded text-white/70 hover:text-white hover:bg-white/10"><RotateCcw className="w-3.5 h-3.5" /></button>
          </div>
          <canvas ref={canvasRef} className="w-full h-64 sm:h-80 cursor-grab active:cursor-grabbing touch-none select-none" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {[
            { label: t('high'), value: priceData?.high ? fmtPrice(priceData.high, curr) : '—' },
            { label: t('low'), value: priceData?.low ? fmtPrice(priceData.low, curr) : '—' },
            { label: t('volume'), value: priceData?.volume?.toLocaleString() || '—' },
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
            {t('targetPrice')}: {fmtPrice(stock.targetPrice, curr)}
            {priceData && <span className="text-sa-text-secondary ml-1">({((stock.targetPrice - priceData.price) / priceData.price * 100).toFixed(1)}%)</span>}
          </div>
        )}
      </div>
    </div>
  );
}
