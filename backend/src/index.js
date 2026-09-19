import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import searchRouter from './routes/search.js';
import productsRouter from './routes/products.js';
import scrapeRouter from './routes/scrape.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend origin
app.use(cors({
  origin: '*', // Allows local dev and deployed frontend
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Cron-Secret']
}));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ine-price-tracker-backend',
    timestamp: new Date().toISOString()
  });
});

// Register API Routes
app.use('/api/search', searchRouter);
app.use('/api/products', productsRouter);
app.use('/api', scrapeRouter);

// Global 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Express Error]:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`INE Price Tracker Backend API running on port ${PORT}`);
  console.log(`Target Store URL: ${process.env.TARGET_BASE_URL || 'https://demo.inelabteamdev.com'}`);
  console.log(`Cron Protection: ${process.env.CRON_SECRET ? 'Enabled' : 'Disabled'}`);
  console.log(`====================================================`);
});
