import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const api = {
  // 1. Search mock catalog
  searchCatalog: async (query = '') => {
    const res = await client.get('/api/search', { params: { q: query } });
    return res.data;
  },

  // 2. List all tracked products with latest stats
  getTrackedProducts: async () => {
    const res = await client.get('/api/products');
    return res.data.products || [];
  },

  // 3. Track a product
  trackProduct: async ({ productId, name, urlSlug }) => {
    const res = await client.post('/api/products/track', { productId, name, urlSlug });
    return res.data;
  },

  // 4. Get product price/stock history
  getProductHistory: async (productId) => {
    const res = await client.get(`/api/products/${productId}/history`);
    return res.data.history || [];
  },

  // 5. Get product scrape logs
  getProductLogs: async (productId) => {
    const res = await client.get(`/api/products/${productId}/logs`);
    return res.data.logs || [];
  }
};
