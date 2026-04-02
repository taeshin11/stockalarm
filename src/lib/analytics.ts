const GOOGLE_SHEETS_URL = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_URL || '';

export async function collectData(action: string, data: Record<string, unknown> = {}) {
  if (!GOOGLE_SHEETS_URL) return;

  try {
    fetch(GOOGLE_SHEETS_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        ...data,
        timestamp: new Date().toISOString(),
        locale: typeof navigator !== 'undefined' ? navigator.language : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      }),
    }).catch(() => {});
  } catch {
    // Silent fail
  }
}
