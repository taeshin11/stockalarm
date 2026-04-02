import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Korean name → ticker mapping for instant local search
const koreanStocks: { ticker: string; name: string; korean: string }[] = [
  { ticker: '005930.KS', name: 'Samsung Electronics', korean: '삼성전자' },
  { ticker: '000660.KS', name: 'SK Hynix', korean: 'SK하이닉스' },
  { ticker: '005380.KS', name: 'Hyundai Motor', korean: '현대자동차' },
  { ticker: '005490.KS', name: 'POSCO Holdings', korean: '포스코홀딩스' },
  { ticker: '035420.KS', name: 'NAVER Corp', korean: '네이버' },
  { ticker: '035720.KS', name: 'Kakao Corp', korean: '카카오' },
  { ticker: '051910.KS', name: 'LG Chem', korean: 'LG화학' },
  { ticker: '006400.KS', name: 'Samsung SDI', korean: '삼성SDI' },
  { ticker: '003670.KS', name: 'POSCO Future M', korean: '포스코퓨처엠' },
  { ticker: '105560.KS', name: 'KB Financial Group', korean: 'KB금융' },
  { ticker: '055550.KS', name: 'Shinhan Financial', korean: '신한지주' },
  { ticker: '012330.KS', name: 'Hyundai Mobis', korean: '현대모비스' },
  { ticker: '066570.KS', name: 'LG Electronics', korean: 'LG전자' },
  { ticker: '003550.KS', name: 'LG Corp', korean: 'LG' },
  { ticker: '028260.KS', name: 'Samsung C&T', korean: '삼성물산' },
  { ticker: '034730.KS', name: 'SK Inc', korean: 'SK' },
  { ticker: '032830.KS', name: 'Samsung Life Insurance', korean: '삼성생명' },
  { ticker: '009150.KS', name: 'Samsung Electro-Mechanics', korean: '삼성전기' },
  { ticker: '018260.KS', name: 'Samsung SDS', korean: '삼성SDS' },
  { ticker: '086790.KS', name: 'Hana Financial Group', korean: '하나금융지주' },
  { ticker: '096770.KS', name: 'SK Innovation', korean: 'SK이노베이션' },
  { ticker: '000270.KS', name: 'Kia Corp', korean: '기아' },
  { ticker: '207940.KS', name: 'Samsung Biologics', korean: '삼성바이오로직스' },
  { ticker: '068270.KS', name: 'Celltrion', korean: '셀트리온' },
  { ticker: '373220.KS', name: 'LG Energy Solution', korean: 'LG에너지솔루션' },
  { ticker: '247540.KS', name: 'Ecopro BM', korean: '에코프로비엠' },
  { ticker: '036570.KS', name: 'NCsoft', korean: '엔씨소프트' },
  { ticker: '251270.KS', name: 'Netmarble', korean: '넷마블' },
  { ticker: '259960.KS', name: 'Krafton', korean: '크래프톤' },
  { ticker: '352820.KS', name: 'Hive Co', korean: '하이브' },
  { ticker: '003490.KS', name: 'Korean Air', korean: '대한항공' },
  { ticker: '090430.KS', name: 'Amorepacific', korean: '아모레퍼시픽' },
  { ticker: '021240.KS', name: 'Coway Co', korean: '코웨이' },
  { ticker: '030200.KS', name: 'KT Corp', korean: 'KT' },
  { ticker: '017670.KS', name: 'SK Telecom', korean: 'SK텔레콤' },
  { ticker: '010950.KS', name: 'S-Oil Corp', korean: 'S-Oil' },
  { ticker: '033780.KS', name: 'KT&G Corp', korean: 'KT&G' },
];

// International stocks with multi-language aliases
const internationalStocks: { ticker: string; name: string; aliases: string[] }[] = [
  { ticker: 'AAPL', name: 'Apple Inc.', aliases: ['애플', 'アップル', '苹果', 'manzana'] },
  { ticker: 'NVDA', name: 'NVIDIA Corporation', aliases: ['엔비디아', 'エヌビディア', '英伟达'] },
  { ticker: 'MSFT', name: 'Microsoft Corporation', aliases: ['마이크로소프트', 'マイクロソフト', '微软'] },
  { ticker: 'GOOGL', name: 'Alphabet Inc.', aliases: ['구글', 'グーグル', '谷歌', 'google'] },
  { ticker: 'AMZN', name: 'Amazon.com Inc.', aliases: ['아마존', 'アマゾン', '亚马逊'] },
  { ticker: 'TSLA', name: 'Tesla Inc.', aliases: ['테슬라', 'テスラ', '特斯拉'] },
  { ticker: 'META', name: 'Meta Platforms Inc.', aliases: ['메타', 'メタ', '脸书', 'facebook'] },
  { ticker: 'TSM', name: 'TSMC', aliases: ['TSMC', '대만반도체', '台積電', '台积电'] },
  { ticker: 'AVGO', name: 'Broadcom Inc.', aliases: ['브로드컴', 'ブロードコム', '博通'] },
  { ticker: 'JPM', name: 'JPMorgan Chase', aliases: ['JP모건', 'JPモルガン', '摩根大通'] },
  { ticker: 'V', name: 'Visa Inc.', aliases: ['비자', 'ビザ'] },
  { ticker: 'WMT', name: 'Walmart Inc.', aliases: ['월마트', 'ウォルマート', '沃尔玛'] },
  { ticker: 'BRK-B', name: 'Berkshire Hathaway', aliases: ['버크셔해서웨이', 'バークシャー', '伯克希尔'] },
  { ticker: 'UNH', name: 'UnitedHealth Group', aliases: ['유나이티드헬스'] },
  { ticker: 'JNJ', name: 'Johnson & Johnson', aliases: ['존슨앤존슨', 'ジョンソン'] },
  { ticker: 'NFLX', name: 'Netflix Inc.', aliases: ['넷플릭스', 'ネットフリックス', '奈飞'] },
  { ticker: 'DIS', name: 'Walt Disney Co.', aliases: ['디즈니', 'ディズニー', '迪士尼'] },
  { ticker: 'NKE', name: 'Nike Inc.', aliases: ['나이키', 'ナイキ', '耐克'] },
  { ticker: 'SBUX', name: 'Starbucks Corp.', aliases: ['스타벅스', 'スターバックス', '星巴克'] },
  { ticker: 'BA', name: 'Boeing Co.', aliases: ['보잉', 'ボーイング', '波音'] },
];

// Detect if query contains non-ASCII (likely a foreign language search)
function isNonAscii(str: string): boolean {
  return /[^\x00-\x7F]/.test(str);
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q');
  if (!query || query.length < 1) {
    return NextResponse.json([]);
  }

  const q = query.toLowerCase();

  // 1. Local Korean stock search
  const koreanMatches = koreanStocks.filter(s =>
    s.korean.toLowerCase().includes(q) ||
    s.name.toLowerCase().includes(q) ||
    s.ticker.toLowerCase().includes(q)
  ).map(s => ({ ticker: s.ticker, name: `${s.name} (${s.korean})` }));

  // 2. International stocks with aliases (multi-language)
  const intlMatches = internationalStocks.filter(s =>
    s.name.toLowerCase().includes(q) ||
    s.ticker.toLowerCase().includes(q) ||
    s.aliases.some(a => a.toLowerCase().includes(q))
  ).map(s => ({ ticker: s.ticker, name: s.name }));

  const localResults = [...koreanMatches, ...intlMatches];

  // 3. If query is non-ASCII and no local matches, use Gemini to translate
  let aiResults: { ticker: string; name: string }[] = [];
  if (isNonAscii(q) && localResults.length === 0) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent({
          contents: [{
            role: 'user',
            parts: [{
              text: `The user is searching for a stock using this query in their local language: "${query}"
Identify the stock(s) they mean and return a JSON array of objects with "ticker" (Yahoo Finance symbol) and "name" (English company name).
Return at most 5 results. ONLY return the JSON array, no markdown, no explanation.
Example: [{"ticker":"AAPL","name":"Apple Inc."}]`
            }]
          }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 300 },
        });
        const text = result.response.text().trim();
        const match = text.match(/\[[\s\S]*?\]/);
        if (match) {
          aiResults = JSON.parse(match[0]);
        }
      } catch {
        // Silent fail
      }
    }
  }

  // 4. Yahoo Finance API search (works best with English/ticker queries)
  let yahooResults: { ticker: string; name: string }[] = [];
  try {
    const searchQuery = isNonAscii(q) && aiResults.length > 0
      ? aiResults[0].ticker // Use AI-translated ticker for Yahoo
      : query;
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(searchQuery)}&quotesCount=10&newsCount=0`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (res.ok) {
      const data = await res.json();
      yahooResults = (data.quotes || [])
        .filter((item: any) => item.quoteType === 'EQUITY' || item.quoteType === 'ETF')
        .map((item: any) => ({
          ticker: item.symbol,
          name: item.shortname || item.longname || item.symbol,
        }))
        .slice(0, 10);
    }
  } catch {
    // Silent fail
  }

  // 5. Merge all results (local → AI → Yahoo), deduplicate
  const seen = new Set<string>();
  const merged: { ticker: string; name: string }[] = [];

  for (const item of [...localResults, ...aiResults, ...yahooResults]) {
    if (!seen.has(item.ticker)) {
      seen.add(item.ticker);
      merged.push(item);
    }
  }

  return NextResponse.json(merged.slice(0, 15));
}
