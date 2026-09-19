import React from 'react';
import {
  TrendingUp,
  Package,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Plus,
  RefreshCw
} from 'lucide-react';

export default function Dashboard({
  products = [],
  loading = false,
  onRefresh,
  onSelectProduct,
  onGoToSearch
}) {
  const renderStatusBadge = (outcome) => {
    switch (outcome) {
      case 'success':
        return (
          <span className="badge badge-success">
            <CheckCircle2 size={12} />
            Healthy
          </span>
        );
      case 'retried':
        return (
          <span className="badge badge-warning">
            <AlertTriangle size={12} />
            Retried
          </span>
        );
      case 'failed':
        return (
          <span className="badge badge-danger">
            <XCircle size={12} />
            Failing
          </span>
        );
      default:
        return (
          <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.08)', color: '#94a3b8' }}>
            Pending Scrape
          </span>
        );
    }
  };

  return (
    <div className="page-container">
      <div className="dashboard-hero">
        <div>
          <h2 className="page-title">Monitoring Dashboard</h2>
          <p className="page-subtitle">
            Overview of tracked products on a 2-hour automated scraping schedule with Supabase persistence.
          </p>
        </div>

        <div className="hero-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onRefresh}
            disabled={loading}
            title="Refresh dashboard data"
          >
            <RefreshCw size={15} className={loading ? 'spinner-icon' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={onGoToSearch}
          >
            <Plus size={16} />
            <span>Track New Product</span>
          </button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="metrics-grid">
        <div className="glass-card metric-card">
          <div className="metric-label">Tracked Products</div>
          <div className="metric-val">{products.length}</div>
          <div className="metric-sub">Active in Supabase registry</div>
        </div>

        <div className="glass-card metric-card">
          <div className="metric-label">Scraper Schedule</div>
          <div className="metric-val">Every 2 Hrs</div>
          <div className="metric-sub">Triggered via cron-job.org</div>
        </div>

        <div className="glass-card metric-card">
          <div className="metric-label">Healthy Scrapes</div>
          <div className="metric-val text-success">
            {products.filter((p) => p.lastScrapeOutcome === 'success').length}
          </div>
          <div className="metric-sub">Recent scrapes succeeded</div>
        </div>
      </div>

      {/* Products Listing */}
      {products.length === 0 && !loading ? (
        <div className="glass-card empty-state">
          <Package size={44} className="text-muted" />
          <p className="empty-title">No Products Tracked Yet</p>
          <p className="empty-subtitle">
            Search the store catalog and add items to begin logging price trends.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onGoToSearch}
            style={{ marginTop: '1rem' }}
          >
            <Plus size={16} />
            <span>Search Catalog Now</span>
          </button>
        </div>
      ) : (
        <div className="tracked-products-grid">
          {products.map((product) => {
            const hasPrice = product.latestPrice !== null && product.latestPrice !== undefined;
            const inStock = product.latestStock !== null && product.latestStock > 0;

            return (
              <div
                key={product.productId}
                className="glass-card product-card cursor-pointer"
                onClick={() => onSelectProduct(product.productId)}
              >
                <div className="card-top">
                  <span className="product-id-pill">ID #{product.productId}</span>
                  {renderStatusBadge(product.lastScrapeOutcome)}
                </div>

                <h3 className="product-card-title">{product.name}</h3>

                <div className="product-price-section">
                  <div className="price-display">
                    {hasPrice ? (
                      <>
                        <span className="price-currency">{product.currency || 'INR'}</span>
                        <span className="price-amount">₹{Number(product.latestPrice).toLocaleString()}</span>
                      </>
                    ) : (
                      <span className="price-pending">Price awaiting first scrape</span>
                    )}
                  </div>

                  <div className="stock-display">
                    {product.latestStock !== null ? (
                      inStock ? (
                        <span className="stock-tag in-stock">{product.latestStock} in stock</span>
                      ) : (
                        <span className="stock-tag out-of-stock">Out of Stock</span>
                      )
                    ) : (
                      <span className="stock-tag stock-unknown">—</span>
                    )}
                  </div>
                </div>

                {product.lastScrapedAt && (
                  <div className="card-last-scraped">
                    <Clock size={13} />
                    <span>
                      Last checked{' '}
                      {new Date(product.lastScrapedAt).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                )}

                <div className="card-click-footer">
                  <span>View Price History & Scrape Logs</span>
                  <ArrowRight size={15} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
