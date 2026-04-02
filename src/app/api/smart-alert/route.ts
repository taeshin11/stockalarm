import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: NextRequest) {
  try {
    const { prompt, stockData } = await request.json();

    if (!prompt || !stockData) {
      return NextResponse.json({ error: 'prompt and stockData required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ triggered: false, reason: 'Gemini API key not configured' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const systemPrompt = `You are a stock alert condition evaluator. Given stock data and a user's alert condition, determine if the condition is met. Respond with ONLY a JSON object: {"triggered": true/false, "reason": "brief explanation"}. No markdown, no code blocks, just the JSON.`;

    const userMessage = `Stock data: ${JSON.stringify(stockData)}\n\nUser's alert condition: "${prompt}"\n\nIs this condition currently met?`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userMessage}` }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 200,
      },
    });

    const text = result.response.text().trim();

    try {
      // Try direct parse
      const parsed = JSON.parse(text);
      return NextResponse.json(parsed);
    } catch {
      // Try to extract JSON from response
      const match = text.match(/\{[\s\S]*?\}/);
      if (match) {
        return NextResponse.json(JSON.parse(match[0]));
      }
      return NextResponse.json({ triggered: false, reason: 'Could not parse AI response' });
    }
  } catch (error: any) {
    return NextResponse.json({ triggered: false, reason: error?.message || 'Server error' }, { status: 500 });
  }
}
