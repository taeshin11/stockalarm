# StockAlarm — Product Requirements Document

## Overview

**StockAlarm** is a free, responsive web application by **SPINAI** that displays multiple stock charts on a single screen with customizable price target alerts. It is built with Next.js 14, TypeScript, and Tailwind CSS, deployed on Vercel.

---

## Core Features

### 1. Multi-Chart Grid
- Display up to **12 mini-charts** simultaneously in a responsive grid layout.
- Each mini-chart shows the stock ticker, current price, and percentage change.
- Real-time price updates via free APIs (Yahoo Finance proxy, etc.).

### 2. Price Target Alerts
- Users can set a **buy target price** for any stock.
- A **red dashed line** appears on the chart at the target price level.
- When the current price hits the target:
  - **Glow animation** effect on the chart card.
  - **Alarm sound** plays to notify the user.

### 3. Expanded Chart Modal
- Click any mini-chart to open a **detailed modal view**.
- Shows full candlestick/line chart with volume, time range selector, and additional indicators.

### 4. Add / Remove Stocks
- Users can search and add stocks to their grid.
- Remove stocks from the grid with a single click.

---

## Internationalization (i18n)

- **Auto language detection** based on browser locale.
- Supported languages: `en`, `ko`, `ja`, `zh-CN`, `es`, `de`, `fr`, `pt`.
- Powered by `next-intl`.

---

## Data & APIs

- All data sourced from **free APIs** (Yahoo Finance proxy, etc.).
- No paid API keys required for core functionality.

---

## Silent Data Collection

- **Google Sheets webhook** for silent, anonymous usage data collection.
- No personal data stored; only aggregate interaction metrics.

---

## Feedback

- **Feedback button** in the app that opens an email to: `taeshinkim11@gmail.com`.

---

## Branding & Design

- **SPINAI** branding in the footer only — no intrusive branding elsewhere.
- **Soft dark theme**:
  - Background: `#0f1219`
  - Card: `#1a1f2e`
  - Border: `#2a2f3e`
  - Text: `#e2e8f0` / Secondary: `#94a3b8`
  - Up: `#4ade80` / Down: `#f87171`
  - Alert: `#ef4444`
  - Accent: `#60a5fa`

---

## SEO Optimization

- **Server-Side Rendering (SSR)** via Next.js.
- Auto-generated **sitemap.xml**.
- **JSON-LD** structured data.
- **hreflang** tags for all supported languages.

---

## Deployment & Infrastructure

- **Deploy on Vercel** (free tier).
- **GitHub repository** created and managed via `gh` CLI.

---

## Future Plans

- **Pro tier** at **$7.50/month** — half the price of competitors.
- Additional features for Pro users (TBD).

---

## Tech Stack

| Layer        | Technology                        |
|-------------|-----------------------------------|
| Framework   | Next.js 14 (App Router)          |
| Language    | TypeScript                        |
| Styling     | Tailwind CSS                      |
| State       | Zustand                           |
| i18n        | next-intl                         |
| Charts      | TBD (lightweight charting lib)    |
| Deployment  | Vercel                            |
| Repo        | GitHub (via gh CLI)               |
