import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { chatId, message, botToken } = await request.json();

    if (!chatId || !message) {
      return NextResponse.json({ error: 'chatId and message required' }, { status: 400 });
    }

    // Use user-provided bot token or env default
    const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return NextResponse.json({ error: 'No Telegram bot token configured' }, { status: 400 });
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json({ error: err.description || 'Telegram API error' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
