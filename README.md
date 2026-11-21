# SmartPos

A simple, affordable point-of-sale and business management system for small businesses in Zambia.

## Features (MVP)

- **Sales:** record sales, digital receipts (share via WhatsApp or print), sales history, refunds
- **Inventory:** products, automatic stock deduction after each sale, low-stock alerts, stock valuation
- **Finance:** expenses, daily profit, 7-day and 30-day reports, cash flow by payment type
- **Payment types:** cash, MTN MoMo, Airtel Money, Zamtel Kwacha (manual transaction reference for now)

## Tech

Next.js, TypeScript, Supabase (Postgres + Auth + Row Level Security), deployed on Vercel.

## Run locally

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase URL and publishable key
npm run dev
```

## Roadmap

- Offline-first selling with background sync
- Real mobile money reconciliation (MTN, Airtel, Zamtel)
- AI business insights ("How much did I make this week?")
- Variants for clothing stores, expiry/batch tracking for pharmacies
