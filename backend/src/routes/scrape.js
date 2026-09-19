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
 * Iterates through all tracked products, runs Playwright scraper with concurrency pool (3),
 * writes each attempt to scrape_logs, and writes to price_history ONLY on success.
 */
router.post('/scrape-all', async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;

  // Header validation
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

  const batchStartTime = Date.now();
  console.log('[Scrape-All] Scheduled scrape initiated...');

  try {
    // 1. Fetch all tracked products
    const { data: products, error: fetchErr } = await supabase
      .from('tracked_products')
      .select('id, product_id, name, url_slug');

    if (fetchErr) {
      console.error('[Scrape-All] Error fetching tracked products:', fetchErr);
      return res.status(500).json({ error: fetchErr.message });
    }

    if (!products || products.length === 0) {
      return res.json({
        message: 'No tracked products found to scrape.',
        total: 0,
        succeeded: 0,
        failed: 0,
        durationMs: Date.now() - batchStartTime,
        results: []
      });
    }

    console.log(`[Scrape-All] Found ${products.length} products to scrape. Processing with concurrency of 3...`);

    // 2. Process products with concurrency pool of 3 (per spec: 3-4 at a time)
    const CONCURRENCY = 3;

    const results = await asyncPool(products, CONCURRENCY, async (product) => {
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

      // 3. Write EVERY attempt to scrape_logs table (honest audit log)
      const attempts = scrapeResult.attempts || [];
      for (const att of attempts) {
        try {
          await supabase.from('scrape_logs').insert([
            {
              product_id: pId,
              outcome: att.outcome, // 'success' | 'retried' | 'failed'
              attempt_number: att.attempt,
              detail: att.detail || (scrapeResult.success ? 'Success' : scrapeResult.reason),
              duration_ms: att.durationMs || 0
            }
          ]);
        } catch (logErr) {
          console.error(`[Scrape-All] Failed to write log for product ${pId}:`, logErr);
        }
      }

      // 4. Write to price_history ONLY on success — NEVER on failure, NEVER null/zero placeholder
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

      return {
        productId: pId,
        name: product.name,
        success: scrapeResult.success,
        price: scrapeResult.success ? scrapeResult.data?.price : null,
        stock: scrapeResult.success ? scrapeResult.data?.stock : null,
        currency: scrapeResult.success ? scrapeResult.data?.currency : null,
        attemptsCount: attempts.length,
        durationMs: scrapeResult.totalDurationMs,
        reason: scrapeResult.success ? null : scrapeResult.reason
      };
    });

    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const totalDurationMs = Date.now() - batchStartTime;

    console.log(`[Scrape-All] Batch complete in ${totalDurationMs}ms: ${succeeded} succeeded, ${failed} failed.`);

    return res.json({
      summary: {
        total: products.length,
        succeeded,
        failed,
        totalDurationMs
      },
      results
    });
  } catch (error) {
    console.error('[Scrape-All Critical Error]:', error);
    return res.status(500).json({ error: error.message || 'Internal batch scrape failure' });
  }
});

export default router;
