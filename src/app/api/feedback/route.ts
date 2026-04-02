import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, email } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Send via Google Apps Script webhook if configured
    const webhookUrl = process.env.FEEDBACK_WEBHOOK_URL;
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'feedback',
          message,
          email: email || 'not provided',
          timestamp: new Date().toISOString(),
          source: 'StockAlarm',
        }),
      }).catch(() => {});
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
