# INE Product Price Tracker: Resilient Web Scraping System

**Author:** Tanmay Gupta

A full-stack app that lets you search INE's mock storefront, track a product, and watch its
price/stock over time through a scraper that runs on a fixed schedule and never silently reports
data it doesn't actually have.

- **Live site:** https://ine-proce.vercel.app
- **Backend API:** https://ine-price-tracker-backend-s83t.onrender.com
- **Target store:** https://demo.inelabteamdev.com

## Why this needed more than a fetch + parser

The brief nudges you toward lightweight fetching and only reaching for a headless browser when
the page genuinely requires it, so that's where I started. A plain request to the homepage came
back as an almost-empty HTML shell, which is normal for a client-rendered SPA. What's not normal
is how far the store goes to stop you from just calling the underlying API directly: the product
page requires the client to solve a WebAssembly proof-of-work challenge, produce a canvas/WebGL
fingerprint, and prove real mouse interaction (movement + a minimum dwell time) before the server
hands back a short-lived (30s) scoped Bearer token and the actual price payload at
`/api/products/:id/price`. There's no static JSON endpoint hiding underneath any of that. A
fetch-based scraper genuinely cannot get a real price here, however it's written.

Given that, the scraper uses **Playwright Chromium**, and that's a judgment call, not a default.
A fetch/Cheerio approach was tried first and returns none of the real data, since the price is
only computed and encrypted client-side after the challenge passes. Playwright is kept narrow,
with one page load and one price extraction per attempt, browser closed right after, rather than
used as a general-purpose crawler.

## Architecture

- **Frontend:** React (Vite), Recharts for the price/stock chart, deployed on Vercel
- **Backend:** Node.js + Express, deployed on Render
- **Database:** Supabase (PostgreSQL), `tracked_products`, `price_history`, `scrape_logs`
- **Scraper:** Playwright Chromium (headless by default, headed mode available) with
  network-response interception and an in-page `JSON.parse` spy to capture the decrypted price
  payload straight from the client runtime, plus retry/backoff on failure
- **Scheduler:** external cron (cron-job.org) hits `POST /api/scrape-all` every 2 hours, the
  Render free tier sleeps on idle, so an always-on `setInterval` loop inside the Node process
  would simply stop firing; an external trigger wakes the service up instead

### How a single scrape works (`backend/src/scraper/priceScraper.js`)

1. Launch Chromium, navigate to `/product/:id`.
2. Dismiss any cookie/overlay banners that would intercept clicks.
3. Locate the `.price-block` element, move the mouse into it (starts the site's dwell timer),
   perform a sequence of small mouse movements spaced ~75ms apart, then dwell ~750ms. This
   satisfies the site's interaction-fingerprint check before it will enable the reveal action.
4. Click the "Reveal price" button once enabled.
5. Wait for either the decrypted price payload (captured via an in-page `JSON.parse` hook) or the
   intercepted `/api/products/:id/price` network response.
6. Normalize the payload (`price`, `stock`, `currency`, `mrp`) and validate the price is a real
   number before returning success.
7. On any failure (timeout, non-200 response, missing/invalid price), retry up to `maxAttempts`
   (default 3) with linear backoff (`attempt * 1000ms`). The **last** attempt is logged as
   `failed`; earlier failed attempts are logged as `retried`. No attempt ever returns a guessed
   or zero value. A failure returns `{ success: false, reason }` and nothing else.

### Honest logging, by construction

`POST /api/scrape-all` writes **every** attempt (success, retried, or failed) to `scrape_logs`,
including the duration and a human-readable detail string. It writes to `price_history` **only**
when `scrapeResult.success === true` and the price is a valid number. A failed scrape leaves the
price history untouched rather than inserting a null, zero, or stale-repeated value. This is
enforced in code (`backend/src/routes/scrape.js`), not just by convention.

## Project structure

```
INE-ProjectAssignment/
├── backend/
│   ├── src/
│   │   ├── config/supabase.js         # Supabase client
│   │   ├── scraper/priceScraper.js    # Playwright scraper & retry engine
│   │   ├── routes/search.js           # GET /api/search, proxies + filters the store's catalog
│   │   ├── routes/products.js         # track / history / logs endpoints
│   │   ├── routes/scrape.js           # POST /api/scrape-all (cron target)
│   │   ├── index.js                   # Express app entry
│   │   └── testScraper.js             # Standalone CLI test harness (single + batch mode)
│   ├── supabase/migrations/001_create_schema.sql
│   └── .env.example
├── frontend/
│   ├── src/{components,pages,services}
│   └── .env.example
└── README.md
```

## API endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness check |
| GET | `/api/search?q=` | Proxies the store's catalog, filters by name/brand/category/SKU |
| GET | `/api/products` | Lists tracked products with latest price/stock/log outcome |
| POST | `/api/products/track` | Body `{ productId, name, urlSlug }`, starts tracking a product |
| GET | `/api/products/:productId/history` | Price/stock history for charting |
| GET | `/api/products/:productId/logs` | Full scrape attempt log (success/retried/failed) |
| POST | `/api/scrape-all` | Cron target, scrapes every tracked product; responds `202` immediately, runs the batch in the background so cron-job.org never times out waiting |

`/api/scrape-all` can optionally be protected with a shared secret: set `CRON_SECRET` on the
backend and configure cron-job.org to send it as either an `X-Cron-Secret` header or an
`Authorization: Bearer <secret>` header.

## Environment variables

**backend/.env**
```
PORT=5000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-or-anon-key
SCRAPER_HEADLESS=true
TARGET_BASE_URL=https://demo.inelabteamdev.com
CRON_SECRET=your_optional_secure_cron_secret
```

**frontend/.env**
```
VITE_API_BASE_URL=http://localhost:5000   # set to the deployed backend URL in production
```

## Scraping schedule

`POST /api/scrape-all` is triggered by an external cron job at **cron-job.org**, configured to
fire every **2 hours** against:

```
https://ine-price-tracker-backend-s83t.onrender.com/api/scrape-all
```

This cron job has been live and firing since September 19, 2026, so the deployed dashboard
reflects real, unattended scrape history, not a single manual run. Getting here wasn't
frictionless. The first version of `/api/scrape-all` ran Chromium instances concurrently across
tracked products, which overloaded Render's free-tier memory and made cron-job.org report the run
as failed. Dropping to sequential scraping (`CONCURRENCY = 1` in `scrape.js`) fixed it. Full
story, including a separate retry-timeout issue I ran into, is in `DESIGN_NOTE.md`.

## Local development

### 1. Database (Supabase)
Run `backend/supabase/migrations/001_create_schema.sql` in the Supabase SQL editor. This creates
`tracked_products`, `price_history`, `scrape_logs`, and the `scrape_outcome` enum
(`success` / `retried` / `failed`).

### 2. Backend
```
cd backend
cp .env.example .env      # fill in SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
npm install
npx playwright install chromium
npm run dev
```

### 3. Frontend
```
cd frontend
cp .env.example .env
npm install
npm run dev
```

### 4. Test the scraper standalone (no server needed)
```
cd backend
npm run test:scraper -- 687              # single product, headless
node src/testScraper.js 687 --headed     # single product, watch the browser
node src/testScraper.js --batch --count=15   # batch reliability run
```

## Deployment

- **Frontend:** Vercel, pointed at `frontend/`, with `VITE_API_BASE_URL` set to the live backend URL.
- **Backend:** Render (web service), pointed at `backend/`, with the env vars above set in the
  Render dashboard. Build/start: `npm install && npx playwright install --with-deps chromium`,
  start command `npm start`.
- **Database:** Supabase Postgres, schema applied via the migration file above.
- **Scheduler:** cron-job.org, POST every 2 hours to `<backend URL>/api/scrape-all`.

## Headed run

For a visible, watchable run of the scraper (used for the submitted screen recording):
```
node src/testScraper.js <productId> --headed
```
This launches a non-headless Chromium window and prints every attempt's outcome
(`success` / `retried` / `failed`) with duration, so a slow or failing response is visible both
in the browser window and in the terminal log.
