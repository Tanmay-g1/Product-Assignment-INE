# Design Note: INE Product Price Tracker

**Author:** Tanmay Gupta

## Why I ended up on Playwright instead of a lightweight fetch

The brief nudges you toward fetching + parsing and only reaching for a headless browser when the
page genuinely needs it, so that's where I started. A plain request to the store's homepage came
back as basically an empty shell: a client-rendered SPA, which was expected. What I didn't
expect was how
far the store goes to stop you from just finding the underlying API and hitting it directly.

Opening the product page in DevTools, the price isn't served as plain JSON anywhere. Before the
server will return anything, the client has to solve a WebAssembly proof-of-work challenge,
produce a canvas/WebGL fingerprint, *and* prove it's a real person moving a mouse (minimum
movement + a dwell time inside the price element). Only then does it get a scoped Bearer token
that's valid for 30 seconds, which it uses to fetch an encrypted price blob. There's no static
JSON endpoint hiding underneath any of this. A fetch-based scraper simply cannot get a real
price here, no matter how it's written. So Playwright wasn't a shortcut; it was the only option
that could actually pass the site's own checks.

I tried to keep it narrow rather than turning it into a general crawler: one page load, one
price extraction, browser closed immediately after.

## How I made the scrape itself reliable

- **The mouse movement and dwell aren't cosmetic.** The scraper moves into the `.price-block`
  element, does a sequence of small movements ~75ms apart, then waits ~750ms before clicking
  "Reveal price." Skimp on this and the reveal button just stays disabled and the whole attempt
  times out. I hit this early on and had to actually tune the numbers against what the site
  seemed to expect.
- **I capture the price two different ways, not one.** An in-page hook overrides `JSON.parse` so
  I get the decrypted price object the instant the site's own client code produces it, and I
  also listen on the raw network response as a cross-check. Relying on just the network layer
  risks missing data that only ever exists decrypted in-memory; relying on just the in-page hook
  risks missing cases where the network call itself failed outright.
- **Retries are capped, not endless.** Up to 3 attempts per product, with a short linear backoff
  (1s, then 2s) between them. The first failures get logged as `retried`; only the final one is
  logged as `failed`.
- **Nothing gets written unless it's a real number.** If the price comes back `NaN`, `null`, or
  missing, that's treated as a failed attempt, not stored as zero or left blank and called a
  success.

## Keeping the logging honest

`/api/scrape-all` writes every attempt (success, retried, or failed) to `scrape_logs`, with a
timestamp, duration, and a plain description of what happened. `price_history` only gets a new
row when a scrape actually succeeded with a valid price. If a cycle fails, the log says so and
the price history just doesn't get a new entry for that run: no null rows, no repeating the last
known price and pretending it's fresh. I wanted the chart and the log to always agree with each
other rather than the chart quietly smoothing over something the log admits went wrong.

## What actually broke, and how I found it

**A retry timeout that was shorter than the site's own retry behaviour.** While batch-testing, I
noticed some runs against a single product (product 272, specifically) were taking around 37
seconds across two attempts instead of just failing fast or succeeding fast. My first guess was
that the 30-second Bearer token was expiring mid-flight, but the timing didn't support that: the
price request fires about 15ms after the token is issued, nowhere close to the 30s limit. What
was actually happening: the store itself returns a `503 upstream_error` sometimes, and when it
does, its *own* client code runs an internal retry loop (up to 6 attempts) before it resolves,
and that can genuinely take 10–15 seconds. My scraper's own wait for the decrypted price was set
to a 15,000ms timeout, which meant I was sometimes giving up and starting a fresh attempt right as
the site's own retry was about to succeed on its own. I bumped my wait to 24,000ms so it roughly
covers the site's worst-case internal retry time instead of racing against it.

**Cron runs were failing even though everything worked manually.** This one took longer to pin
down. Every time I ran `testScraper.js` against a single product it worked fine. But once
`/api/scrape-all` was wired up to cron-job.org and running across all tracked products, cron-job.org
started reporting the run as failed with an "output too large" error, and Render sent me an email
about resource usage on the service. What was actually going on: `/api/scrape-all` was launching
a Chromium instance per product concurrently, and on Render's free 512MB tier that pushed memory
past the limit, so instead of my JSON response, cron-job.org was receiving Render's own large
HTML error page, which is what it was flagging as oversized. The fix was dropping concurrency to
1, so each product is scraped fully (browser opened, used, closed) before the next one starts.
Slower overall, but it actually finishes the batch instead of falling over partway through, and
the cron job has been running clean since I made that change.

**Smaller fix:** the price history table originally defaulted currency to `'USD'`. Since the
store actually prices everything in rupees, I changed the default to `'INR'` so what's stored
matches what's actually being scraped and shown.

Both of the real issues above only showed up under something close to real scheduled conditions.
Single-product manual runs never surfaced either of them. What actually caught them was reading
the raw terminal output and the actual DB rows after batch runs, rather than trusting that code
which looked structurally fine was behaving correctly.

## Trade-offs I made on purpose

- **Playwright over fetch**, even though the brief leans toward lightweight fetching. The
  store's own design rules that out; there's no honest way to get a real price without a real
  browser passing its checks.
- **Concurrency = 1**, not a default I picked up front. I only landed here after the concurrent
  version overloaded Render's free tier during a real scheduled run. Slower per cycle, but
  reliable within the memory budget I actually have.
- **The batch endpoint responds immediately and scrapes in the background** (`202` first, then
  the loop runs after the response is sent) so cron-job.org's request never times out waiting on
  however long a full sequential batch takes.
- **Backoff is short and linear (1s, 2s) rather than exponential.** This was deliberate: since
  the whole thing re-runs every 2 hours anyway, I'd rather let the next scheduled cycle catch a
  transient failure than make one cron-triggered run drag on trying to ride it out.

## What I didn't get to

None of the bonus features (price-drop/back-in-stock alerts, structural change detection,
per-product scrape frequency, CI/CD) are built. Given the two-day window, I put the time into
making the core scraping actually trustworthy and honestly logged, which is what the brief itself
says to prioritize over partial bonus work.
