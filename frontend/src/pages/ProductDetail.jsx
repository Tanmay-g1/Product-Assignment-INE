import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ExternalLink,
  Star,
  Truck,
  MapPin,
  TrendingDown,
  Package,
  Calendar,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { api } from '../services/api';
import PriceChart from '../components/PriceChart';
import ScrapeLogTable from '../components/ScrapeLogTable';

export default function ProductDetail({ productId, onBack }) {
  const [product, setProduct] = useState(null);
  const [history, setHistory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [allProducts, histData, logData] = await Promise.all([
        api.getTrackedProducts(),
        api.getProductHistory(productId),
        api.getProductLogs(productId)
      ]);

      const found = allProducts.find((p) => Number(p.productId) === Number(productId));
      setProduct(found || { productId, name: `Product #${productId}` });
      setHistory(histData || []);
      setLogs(logData || []);
    } catch (err) {
      console.error('Failed to load product details:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [productId]);

  if (loading) {
    return (
      <div className="page-container loading-state">
        <Loader2 size={40} className="spinner-icon text-accent" />
        <p>Loading product telemetry & historical records...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <button type="button" className="btn btn-secondary back-btn" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>
        <div className="glass-card error-banner" style={{ marginTop: '1.5rem' }}>
          <AlertCircle size={20} className="text-danger" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  const latestHistory = history[0];
  const currentPrice = latestHistory?.price ?? product?.latestPrice;
  const currentStock = latestHistory?.stock ?? product?.latestStock;
  const currency = latestHistory?.currency || product?.currency || 'INR';

  return (
    <div className="page-container">
      <div className="detail-top-nav">
        <button type="button" className="btn btn-secondary back-btn" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>

        <a
          href={`https://demo.inelabteamdev.com/product/${productId}`}
          target="_blank"
          rel="noreferrer"
          className="btn btn-secondary store-link-btn"
        >
          <span>View on Demo Store</span>
          <ExternalLink size={14} />
        </a>
      </div>

      {/* Product Hero Banner */}
      <div className="glass-card detail-hero-card">
        <div className="detail-hero-main">
          <div className="product-id-pill">ID #{productId}</div>
          <h2 className="detail-title">{product?.name || `Product #${productId}`}</h2>
          <p className="detail-slug">URL Slug: <code>{product?.urlSlug || '—'}</code></p>
        </div>

        <div className="detail-hero-stats">
          <div className="stat-box">
            <div className="stat-box-label">Current Intercepted Price</div>
            <div className="stat-box-value">
              {currentPrice !== null && currentPrice !== undefined ? (
                <>
                  <span className="text-muted" style={{ fontSize: '1.2rem', marginRight: '0.25rem' }}>{currency}</span>
                  ₹{Number(currentPrice).toLocaleString()}
                </>
              ) : (
                <span style={{ fontSize: '1.2rem', color: '#94a3b8' }}>Pending Scrape</span>
              )}
            </div>
            <div className="stat-box-sub">
              {currentStock !== null ? (
                currentStock > 0 ? (
                  <span className="stock-tag in-stock">{currentStock} Units Available</span>
                ) : (
                  <span className="stock-tag out-of-stock">Out of Stock</span>
                )
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Bonus Store Metadata Banner */}
      <div className="metadata-banner glass-card">
        <div className="metadata-item">
          <Star size={18} className="text-amber" />
          <div>
            <div className="meta-label">Customer Rating</div>
            <div className="meta-value">3.8 / 5 <small className="text-muted">(17.5k reviews)</small></div>
          </div>
        </div>

        <div className="metadata-item">
          <MapPin size={18} className="text-accent" />
          <div>
            <div className="meta-label">Verified Merchant</div>
            <div className="meta-value">Ashgrove Depot</div>
          </div>
        </div>

        <div className="metadata-item">
          <Truck size={18} className="text-emerald" />
          <div>
            <div className="meta-label">Delivery Estimate</div>
            <div className="meta-value">4–6 business days</div>
          </div>
        </div>
      </div>

      {/* Recharts Price & Stock Chart */}
      <div style={{ marginBottom: '2rem' }}>
        <PriceChart history={history} currency={currency} />
      </div>

      {/* Transparent Scrape Log Audit Table */}
      <div>
        <ScrapeLogTable logs={logs} />
      </div>
    </div>
  );
}
