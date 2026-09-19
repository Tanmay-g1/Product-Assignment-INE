import express from 'express';

const router = express.Router();

const TARGET_BASE_URL = process.env.TARGET_BASE_URL || 'https://demo.inelabteamdev.com';

/**
 * GET /api/search?q=<query>
 * Proxies to target store's catalog endpoint: /api/catalog?page=1&pageSize=100
 * Performs case-insensitive partial match on product name, brand, category, or SKU.
 */
router.get('/', async (req, res) => {
  try {
    const query = (req.query.q || '').toString().trim().toLowerCase();
    const pageSize = parseInt(req.query.pageSize, 10) || 50;

    const catalogUrl = `${TARGET_BASE_URL}/api/catalog?page=1&pageSize=${pageSize}`;
    const response = await fetch(catalogUrl);

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Failed to fetch catalog from target store (${response.status})`
      });
    }

    const catalogData = await response.json();
    const items = catalogData.items || [];

    // Filter by partial match if query is provided, otherwise return items
    const filtered = query
      ? items.filter(item => {
          const nameMatch = item.name?.toLowerCase().includes(query);
          const brandMatch = item.brand?.toLowerCase().includes(query);
          const catMatch = item.category?.toLowerCase().includes(query);
          const skuMatch = item.sku?.toLowerCase().includes(query);
          return nameMatch || brandMatch || catMatch || skuMatch;
        })
      : items;

    // Return sanitized summary for each match
    const results = filtered.map(item => ({
      productId: item.id,
      name: item.name,
      brand: item.brand,
      category: item.category,
      sku: item.sku,
      slug: item.slug,
      description: item.description,
      productUrl: `${TARGET_BASE_URL}/product/${item.id}`
    }));

    return res.json({
      query,
      count: results.length,
      results
    });
  } catch (error) {
    console.error('[Search Route Error]:', error);
    return res.status(500).json({ error: error.message || 'Internal server error during search' });
  }
});

export default router;
