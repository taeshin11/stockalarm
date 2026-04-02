import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { prompt, stockData } = await request.json();

    if (!prompt || !stockData) {
      return NextResponse.json({ error: 'prompt and stockData required' }, { status: 400 });
    }

    const systemPrompt = `You are a stock alert condition evaluator. Given stock data and a user's alert condition, determine if the condition is met. Respond with ONLY a JSON object: {"triggered": true/false, "reason": "brief explanation"}`;

    const userMessage = `Stock data: ${JSON.stringify(stockData)}\n\nUser's alert condition: "${prompt}"\n\nIs this condition currently met?`;

    const res = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        model: 'openai',
        jsonMode: true,
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ triggered: false, reason: 'AI evaluation failed' });
    }

    const text = await res.text();
    try {
      const result = JSON.parse(text);
      return NextResponse.json(result);
    } catch {
      // Try to extract JSON from response
      const match = text.match(/\{[\s\S]*?\}/);
      if (match) {
        return NextResponse.json(JSON.parse(match[0]));
      }
      return NextResponse.json({ triggered: false, reason: 'Could not parse AI response' });
    }
  } catch {
    return NextResponse.json({ triggered: false, reason: 'Server error' }, { status: 500 });
  }
}
