// Google Apps Script — Deploy as Web App
// 1. Go to https://script.google.com
// 2. Create new project
// 3. Paste this code
// 4. Deploy > New Deployment > Web App
// 5. Set "Who has access" to "Anyone"
// 6. Copy the URL and set as NEXT_PUBLIC_GOOGLE_SHEETS_URL in .env.local

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);

    // Add headers if first row
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Timestamp', 'Action', 'Ticker', 'Target Price', 'Locale', 'User Agent', 'Extra']);
    }

    sheet.appendRow([
      data.timestamp || new Date().toISOString(),
      data.action || '',
      data.ticker || '',
      data.targetPrice || '',
      data.locale || '',
      data.userAgent || '',
      JSON.stringify(data),
    ]);

    return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput('StockAlarm Data Collector is running.')
    .setMimeType(ContentService.MimeType.TEXT);
}
