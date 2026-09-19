import express from 'express';
import { supabase } from '../config/supabase.js';

const router = express.Router();

/**
 * GET /api/products
 * List all tracked products with their latest price, stock status, and last scrape time.
 */
router.get('/', async (req, res) => {
  try {
    const { data: products, error: prodError } = await supabase
      .from('tracked_products')
      .select('*')
      .order('created_at', { ascending: false });

    if (prodError) {
      return res.status(500).json({ error: prodError.message });
    }

    if (!products || products.length === 0) {
      return res.json({ products: [] });
    }

    // Fetch latest price and latest log for each product
    const enriched = await Promise.all(
      products.map(async (p) => {
        const { data: latestPrice } = await supabase
          .from('price_history')
          .select('price, stock, currency, scraped_at')
          .eq('product_id', p.product_id)
          .order('scraped_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: latestLog } = await supabase
          .from('scrape_logs')
          .select('outcome, attempted_at, attempt_number, detail')
          .eq('product_id', p.product_id)
          .order('attempted_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          id: p.id,
          productId: p.product_id,
          name: p.name,
          urlSlug: p.url_slug,
          createdAt: p.created_at,
          latestPrice: latestPrice?.price ?? null,
          latestStock: latestPrice?.stock ?? null,
          currency: latestPrice?.currency ?? 'INR',
          lastScrapedAt: latestPrice?.scraped_at ?? null,
          lastScrapeOutcome: latestLog?.outcome ?? null,
          lastScrapeDetail: latestLog?.detail ?? null
        };
      })
    );

    return res.json({ products: enriched });
  } catch (error) {
    console.error('[Get Products Error]:', error);
    return res.status(500).json({ error: error.message || 'Failed to list tracked products' });
  }
});

/**
 * POST /api/products/track
 * Inserts product into tracked_products if not already present.
 * Body: { productId, name, urlSlug }
 */
router.post('/track', async (req, res) => {
  try {
    const { productId, name, urlSlug } = req.body;

    if (!productId || !name || !urlSlug) {
      return res.status(400).json({
        error: 'Missing required fields: productId, name, and urlSlug are required.'
      });
    }

    const parsedProductId = parseInt(productId, 10);
    if (isNaN(parsedProductId)) {
      return res.status(400).json({ error: 'productId must be a valid integer.' });
    }

    // Check if already tracked
    const { data: existing, error: checkError } = await supabase
      .from('tracked_products')
      .select('*')
      .eq('product_id', parsedProductId)
      .maybeSingle();

    if (checkError) {
      return res.status(500).json({ error: checkError.message });
    }

    if (existing) {
      return res.status(200).json({
        status: 'already_tracked',
        message: `Product ${parsedProductId} ("${existing.name}") is already being tracked.`,
        product: existing
      });
    }

    // Insert new tracked product
    const { data: inserted, error: insertError } = await supabase
      .from('tracked_products')
      .insert([
        {
          product_id: parsedProductId,
          name: name.trim(),
          url_slug: urlSlug.trim()
        }
      ])
      .select()
      .single();

    if (insertError) {
      return res.status(500).json({ error: insertError.message });
    }

    return res.status(201).json({
      status: 'created',
      message: `Product ${parsedProductId} ("${inserted.name}") is now tracked.`,
      product: inserted
    });
  } catch (error) {
    console.error('[Track Product Error]:', error);
    return res.status(500).json({ error: error.message || 'Failed to track product' });
  }
});

/**
 * GET /api/products/:productId/history
 * Returns price_history rows ordered by scraped_at descending for charting.
 */
router.get('/:productId/history', async (req, res) => {
  try {
    const parsedProductId = parseInt(req.params.productId, 10);
    if (isNaN(parsedProductId)) {
      return res.status(400).json({ error: 'productId must be a valid integer.' });
    }

    const limit = parseInt(req.query.limit, 10) || 100;

    const { data: history, error } = await supabase
      .from('price_history')
      .select('*')
      .eq('product_id', parsedProductId)
      .order('scraped_at', { ascending: false })
      .limit(limit);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({
      productId: parsedProductId,
      count: history.length,
      history
    });
  } catch (error) {
    console.error('[Get Price History Error]:', error);
    return res.status(500).json({ error: error.message || 'Failed to get price history' });
  }
});

/**
 * GET /api/products/:productId/logs
 * Returns scrape_logs rows ordered by attempted_at descending for audit table.
 */
router.get('/:productId/logs', async (req, res) => {
  try {
    const parsedProductId = parseInt(req.params.productId, 10);
    if (isNaN(parsedProductId)) {
      return res.status(400).json({ error: 'productId must be a valid integer.' });
    }

    const limit = parseInt(req.query.limit, 10) || 50;

    const { data: logs, error } = await supabase
      .from('scrape_logs')
      .select('*')
      .eq('product_id', parsedProductId)
      .order('attempted_at', { ascending: false })
      .limit(limit);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({
      productId: parsedProductId,
      count: logs.length,
      logs
    });
  } catch (error) {
    console.error('[Get Scrape Logs Error]:', error);
    return res.status(500).json({ error: error.message || 'Failed to get scrape logs' });
  }
});

export default router;
