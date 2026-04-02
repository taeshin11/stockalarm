import { NextRequest, NextResponse } from 'next/server';

const historyCache: Record<string, { data: any; timestamp: number }> = {};
const HISTORY_CACHE_TTL = 60000; // 1 minute

const rangeToInterval: Record<string, { range: string; interval: string }> = {
  '1D': { range: '1d', interval: '5m' },
  '1W': { range: '5d', interval: '15m' },
  '1M': { range: '1mo', interval: '1d' },
  '3M': { range: '3mo', interval: '1d' },
  '1Y': { range: '1y', interval: '1wk' },
};

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker');
  const range = request.nextUrl.searchParams.get('range') || '1M';

  if (!ticker) {
    return NextResponse.json({ error: 'No ticker provided' }, { status: 400 });
  }

  const cacheKey = `${ticker}-${range}`;
  const cached = historyCache[cacheKey];
  if (cached && Date.now() - cached.timestamp < HISTORY_CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  const { range: yahooRange, interval } = rangeToInterval[range] || rangeToInterval['1M'];

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${yahooRange}&interval=${interval}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (res.ok) {
      const json = await res.json();
      const result = json?.chart?.result?.[0];
      if (!result) {
        return NextResponse.json(generateMockHistory(range));
      }

      const timestamps = result.timestamp || [];
      const ohlcv = result.indicators?.quote?.[0] || {};

      const data = timestamps.map((ts: number, i: number) => ({
        time: new Date(ts * 1000).toISOString().split('T')[0],
        open: ohlcv.open?.[i] || 0,
        high: ohlcv.high?.[i] || 0,
        low: ohlcv.low?.[i] || 0,
        close: ohlcv.close?.[i] || 0,
        volume: ohlcv.volume?.[i] || 0,
      })).filter((d: any) => d.close > 0);

      historyCache[cacheKey] = { data, timestamp: Date.now() };
      return NextResponse.json(data);
    }
  } catch {
    // Fall through to mock
  }

  const mockData = generateMockHistory(range);
  historyCache[cacheKey] = { data: mockData, timestamp: Date.now() };
  return NextResponse.json(mockData);
}

function generateMockHistory(range: string) {
  const days = range === '1D' ? 1 : range === '1W' ? 5 : range === '1M' ? 30 : range === '3M' ? 90 : 365;
  const data = [];
  let price = 150;
  const now = new Date();

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const change = (Math.random() - 0.48) * 5;
    price = Math.max(50, price + change);
    data.push({
      time: date.toISOString().split('T')[0],
      open: Math.round((price - Math.random() * 2) * 100) / 100,
      high: Math.round((price + Math.random() * 3) * 100) / 100,
      low: Math.round((price - Math.random() * 3) * 100) / 100,
      close: Math.round(price * 100) / 100,
      volume: Math.floor(Math.random() * 30000000),
    });
  }
  return data;
}
