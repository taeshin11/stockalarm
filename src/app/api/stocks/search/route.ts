import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q');
  if (!query || query.length < 1) {
    return NextResponse.json([]);
  }

  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (res.ok) {
      const data = await res.json();
      const results = (data.quotes || [])
        .filter((q: any) => q.quoteType === 'EQUITY' || q.quoteType === 'ETF')
        .map((q: any) => ({
          ticker: q.symbol,
          name: q.shortname || q.longname || q.symbol,
        }))
        .slice(0, 10);
      return NextResponse.json(results);
    }
  } catch {
    // Fallback
  }

  // Fallback: simple filter
  const fallbackStocks = [
    { ticker: 'AAPL', name: 'Apple Inc.' },
    { ticker: 'NVDA', name: 'NVIDIA Corporation' },
    { ticker: 'MSFT', name: 'Microsoft Corporation' },
    { ticker: 'GOOGL', name: 'Alphabet Inc.' },
    { ticker: 'AMZN', name: 'Amazon.com Inc.' },
    { ticker: 'TSLA', name: 'Tesla Inc.' },
    { ticker: 'META', name: 'Meta Platforms Inc.' },
    { ticker: 'JPM', name: 'JPMorgan Chase' },
    { ticker: 'V', name: 'Visa Inc.' },
    { ticker: 'WMT', name: 'Walmart Inc.' },
  ];
  const q = query.toUpperCase();
  return NextResponse.json(
    fallbackStocks.filter(s => s.ticker.includes(q) || s.name.toUpperCase().includes(q))
  );
}
