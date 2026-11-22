<p align="center">
  <img src="public/logo.png" alt="SmartPOS: Keep Track. Move Fast. Grow Big." width="280" />
</p>

# SmartPOS

A simple, affordable point-of-sale and business management system for small businesses in Zambia.

## Features

- **Sales:** record sales, digital receipts (share via WhatsApp or print), sales history, refunds
- **Inventory:** automatic stock deduction, low-stock alerts, stock valuation
- **Getting products in fast**
  - Starter packs by business type (grocery, hardware, pharmacy, clothing, restaurant): just add prices
  - Paste from Excel / Google Sheets, or upload a CSV (template included)
  - Photo of a stock book or price list, read by AI
  - Barcode scanning with the phone camera (or a USB/Bluetooth scanner): unknown barcodes are added on the spot
  - "Item not listed" at the till for quick one-off sales (stock not counted until set up)
- **Finance:** expenses, daily profit, 7-day and 30-day reports, cash flow by payment type
- **Payment types:** cash, MTN MoMo, Airtel Money, Zamtel Kwacha (manual transaction reference for now)

## Tech

Next.js, TypeScript, Supabase (Postgres, Auth, Row Level Security, Edge Functions), Vercel.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL and publishable key
npm run dev
```

## AI photo import

The `extract-products` edge function (`supabase/functions/extract-products`) uses [Groq](https://console.groq.com) (free tier) and needs one secret:

1. Create a free API key at console.groq.com/keys
2. Supabase dashboard → Edge Functions → Secrets
3. Add `GROQ_API_KEY`
4. Optional: `GROQ_MODEL` to override the default (`qwen/qwen3.8-27b`)

Only signed-in users can call it. Photos are sent to Groq to be read and are not stored by SmartPOS.

## Roadmap

- Offline-first selling with background sync
- Real mobile money reconciliation (MTN, Airtel, Zamtel)
- AI business insights ("How much did I make this week?")
- Variants for clothing stores, expiry/batch tracking for pharmacies
