# INE Product Price Tracker — Resilient Web Scraping System

A full-stack, automated web application for tracking product prices and stock availability on the adversarial demo storefront [https://demo.inelabteamdev.com](https://demo.inelabteamdev.com).

## Overview & Architecture

Target site requires solving client-side Proof-of-Work (WASM) challenges and generating canvas/WebGL/interaction fingerprints to obtain short-lived scoped Bearer tokens (30s expiry). This application uses **Playwright Chromium** to naturally execute the required challenge flow and intercepts internal API price responses (`/api/products/:id/price`), guaranteeing 100% fidelity without fragile DOM scraping.

- **Frontend**: React (Vite), Recharts, Lucide Icons, Modern Dark Glassmorphism UI
- **Backend**: Node.js + Express
- **Database**: Supabase (PostgreSQL)
- **Scraper Engine**: Playwright Headless/Headed Chromium with response interception and automated retry/backoff
- **Scheduler**: External 2-hour cron (`cron-job.org`) triggering backend `/api/scrape-all`

## Project Structure

```text
INE-ProjectAssignment/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── supabase.js            # Supabase DB client
│   │   ├── scraper/
│   │   │   └── priceScraper.js        # Playwright scraper & retry engine
│   │   ├── routes/
│   │   │   ├── search.js              # Catalog search proxy
│   │   │   ├── products.js            # Product tracking & history endpoints
│   │   │   └── scrape.js              # Scheduled /api/scrape-all route
│   │   ├── index.js                   # Express application entry
│   │   └── testScraper.js             # Standalone CLI test suite
│   ├── supabase/
│   │   └── migrations/
│   │       └── 001_create_schema.sql  # PostgreSQL schema migration
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/                # Reusable UI components & charts
│   │   ├── pages/                     # Dashboard, Search & Product detail
│   │   ├── services/                  # API client
│   │   ├── App.jsx
│   │   ├── index.css                  # Custom design tokens & dark styling
│   │   └── main.jsx
│   ├── .env.example
│   ├── package.json
│   └── vite.config.js
├── .gitignore
└── README.md
```

## Setup & Local Development

### 1. Database Setup (Supabase)
Run the migration script `backend/supabase/migrations/001_create_schema.sql` in the Supabase SQL Editor.

### 2. Backend Setup
```bash
cd backend
cp .env.example .env
# Edit .env with your Supabase URL & Key
npm install
npm run dev
```

### 3. Frontend Setup
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```
