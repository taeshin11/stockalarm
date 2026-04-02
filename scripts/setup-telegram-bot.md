# Telegram Bot Setup for StockAlarm

## Create a Bot
1. Open Telegram and search for @BotFather
2. Send /newbot
3. Name: StockAlarm Bot
4. Username: stockalarm_alert_bot (or any available name)
5. Copy the bot token

## Set Environment Variable
Add to .env.local:
```
TELEGRAM_BOT_TOKEN=your_bot_token_here
```

## Users Get Their Chat ID
1. User opens Telegram
2. Searches for @userinfobot
3. Sends any message
4. Gets their Chat ID number
5. Enters it in StockAlarm Settings > Telegram Alerts
