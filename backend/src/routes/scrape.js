import express from 'express';
import { supabase } from '../config/supabase.js';
import { scrapeProductPrice } from '../scraper/priceScraper.js';

const router = express.Router();

/**
 * Concurrency runner helper: processes an array of items with a concurrency pool limit.
 * @param {Array} items
 * @param {number} limit
 * @param {Function} iteratorFn
 */
async function asyncPool(items, limit, iteratorFn) {
  const ret = [];
  const executing = new Set();
  for (const item of items) {
    const p = Promise.resolve().then(() => iteratorFn(item));
    ret.push(p);
    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean, clean);
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  return Promise.all(ret);
}

/**
 * POST /api/scrape-all
 * Protected by X-Cron-Secret or Authorization: Bearer <CRON_SECRET> header.
 *
 * Flow:
 *  1. Validate auth header  -> 401 if wrong
 *  2. Fetch tracked products -> 500 if DB error
 *  3. Respond 202 immediately ("started") — cron-job.org never times out waiting
 *  4. Run the full scrape + audit-log + price-history loop AFTER the response,
 *     in a detached async IIFE (fire-and-forget from the HTTP perspective).
 */
router.post('/scrape-all', async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;

  // Auth check
  const headerSecret = req.header('X-Cron-Secret');
  const authHeader = req.header('Authorization');
  const bearerSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const providedSecret = headerSecret || bearerSecret;

  if (cronSecret && providedSecret !== cronSecret) {
    console.warn('[Scrape-All] Unauthorized trigger attempt with invalid or missing secret.');
    return res.status(401).json({
      error: 'Unauthorized: Invalid or missing X-Cron-Secret header.'
    });
  }

  // Fetch product list synchronously so we can echo count in the 202
  const { data: products, error: fetchErr } = await supabase
    .from('tracked_products')
    .select('id, product_id, name, url_slug');

  if (fetchErr) {
    console.error('[Scrape-All] Error fetching tracked products:', fetchErr);
    return res.status(500).json({ error: fetchErr.message });
  }

  if (!products || products.length === 0) {
    return res.status(202).json({
      status: 'started',
      productsQueued: 0,
      message: 'No tracked products found.'
    });
  }

  // Respond immediately so cron-job.org gets a fast 202
  res.status(202).json({ status: 'started', productsQueued: products.length });

  // Scrape loop runs detached — HTTP connection is already closed
  (async () => {
    const batchStartTime = Date.now();
    console.log(`[Scrape-All] Batch started — ${products.length} products, concurrency 1 (sequential).`);

    const CONCURRENCY = 1; // 1 Chromium instance at a time — avoids OOM on Render free tier (512 MB)

    try {
      await asyncPool(products, CONCURRENCY, async (product) => {
        const pId = product.product_id;
        console.log(`[Scrape-All] Starting scrape for product ${pId} (${product.name})...`);

        let scrapeResult = null;
        try {
          scrapeResult = await scrapeProductPrice(pId, { maxAttempts: 3 });
        } catch (err) {
          scrapeResult = {
            success: false,
            reason: err.message || 'Scraper execution error',
            attempts: [
              {
                attempt: 1,
                durationMs: 0,
                outcome: 'failed',
                detail: err.message || 'Scraper crashed unexpectedly'
              }
            ],
            totalDurationMs: 0
          };
        }

        // Write EVERY attempt to scrape_logs (incremental, per-product)
        const attempts = scrapeResult.attempts || [];
        for (const att of attempts) {
          try {
            await supabase.from('scrape_logs').insert([
              {
                product_id: pId,
                outcome: att.outcome,        // 'success' | 'retried' | 'failed'
                attempt_number: att.attempt,
                detail: att.detail || (scrapeResult.success ? 'Success' : scrapeResult.reason),
                duration_ms: att.durationMs || 0
              }
            ]);
          } catch (logErr) {
            console.error(`[Scrape-All] Failed to write log for product ${pId}:`, logErr);
          }
        }

        // Write to price_history ONLY on success
        if (scrapeResult.success && scrapeResult.data) {
          const { price, stock, currency } = scrapeResult.data;
          if (price !== null && price !== undefined && !isNaN(price)) {
            try {
              await supabase.from('price_history').insert([
                {
                  product_id: pId,
                  price,
                  stock: stock ?? null,
                  currency: currency || 'INR'
                }
              ]);
              console.log(`[Scrape-All] [Product ${pId}] Recorded price: ${currency} ${price} (stock: ${stock})`);
            } catch (priceErr) {
              console.error(`[Scrape-All] Failed to write price history for product ${pId}:`, priceErr);
            }
          }
        } else {
          console.warn(`[Scrape-All] [Product ${pId}] Scrape failed: ${scrapeResult.reason}. Omitted from price_history.`);
        }
      });

      const totalDurationMs = Date.now() - batchStartTime;
      console.log(`[Scrape-All] Batch complete in ${totalDurationMs}ms.`);
    } catch (error) {
      console.error('[Scrape-All Critical Error]:', error);
    }
  })(); // fire-and-forget — intentionally not awaited
});

export default router;
