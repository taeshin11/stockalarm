export async function sendTelegramAlert(
  chatId: string,
  ticker: string,
  currentPrice: number,
  targetPrice: number,
  type: 'buy' | 'sell'
) {
  if (!chatId) return;

  const emoji = type === 'buy' ? '🟢' : '🔴';
  const action = type === 'buy' ? 'BUY' : 'SELL';
  const message = `${emoji} <b>StockAlarm Alert</b>\n\n` +
    `<b>${ticker}</b> hit your ${action} target!\n` +
    `Current: $${currentPrice.toFixed(2)}\n` +
    `Target: $${targetPrice.toFixed(2)}\n\n` +
    `<i>via StockAlarm</i>`;

  try {
    await fetch('/api/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message }),
    });
  } catch {
    // Silent fail
  }
}
