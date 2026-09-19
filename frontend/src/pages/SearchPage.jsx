import React, { useState } from 'react';
import { Search, Plus, Check, ExternalLink, Loader2, Package, Tag, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

export default function SearchPage({ trackedIds = new Set(), onProductTracked }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [trackingId, setTrackingId] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await api.searchCatalog(query);
      setResults(data.results || []);
      setHasSearched(true);
    } catch (err) {
      console.error('Search failed:', err);
      setErrorMessage(err.response?.data?.error || err.message || 'Failed to search catalog');
    } finally {
      setLoading(false);
    }
  };

  const handleTrack = async (item) => {
    setTrackingId(item.productId);
    try {
      await api.trackProduct({
        productId: item.productId,
        name: item.name,
        urlSlug: item.slug
      });
      if (onProductTracked) {
        onProductTracked(item.productId);
      }
    } catch (err) {
      console.error('Tracking failed:', err);
      alert(err.response?.data?.error || 'Failed to track product');
    } finally {
      setTrackingId(null);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">Catalog Search & Product Tracking</h2>
        <p className="page-subtitle">
          Search products on the mock storefront (<code>https://demo.inelabteamdev.com</code>) and add them to your automated scraping schedule.
        </p>
      </div>

      <form onSubmit={handleSearch} className="search-bar-form glass-card">
        <div className="search-input-wrapper">
          <Search size={19} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by name, brand, category, or SKU (e.g., 'monitor', 'nordkraft', 'audio')..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary search-submit-btn" disabled={loading}>
          {loading ? <Loader2 size={16} className="spinner-icon" /> : <Search size={16} />}
          <span>{loading ? 'Searching...' : 'Search Catalog'}</span>
        </button>
      </form>

      {errorMessage && (
        <div className="glass-card error-banner">
          <AlertCircle size={20} className="text-danger" />
          <span>{errorMessage}</span>
        </div>
      )}

      {loading && (
        <div className="loading-state">
          <Loader2 size={36} className="spinner-icon text-accent" />
          <p>Querying store catalog...</p>
        </div>
      )}

      {!loading && hasSearched && results.length === 0 && (
        <div className="glass-card empty-state">
          <Package size={36} className="text-muted" />
          <p className="empty-title">No products found matching "{query}"</p>
          <p className="empty-subtitle">Try searching with a broader keyword or leave blank to list items.</p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="search-results-grid">
          {results.map((item) => {
            const isTracked = trackedIds.has(Number(item.productId));
            const isBusy = trackingId === item.productId;

            return (
              <div key={item.productId} className="glass-card product-search-card">
                <div className="card-top">
                  <div className="card-category-tag">
                    <Tag size={12} />
                    <span>{item.category || 'General'}</span>
                  </div>
                  <span className="sku-tag">{item.sku}</span>
                </div>

                <h4 className="card-name">{item.name}</h4>
                <p className="card-brand">{item.brand}</p>
                <p className="card-desc">{item.description}</p>

                <div className="card-footer">
                  <a
                    href={item.productUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary store-link-btn"
                  >
                    <span>Store View</span>
                    <ExternalLink size={13} />
                  </a>

                  <button
                    type="button"
                    className={`btn ${isTracked ? 'btn-tracked' : 'btn-primary'}`}
                    disabled={isTracked || isBusy}
                    onClick={() => handleTrack(item)}
                  >
                    {isBusy ? (
                      <Loader2 size={15} className="spinner-icon" />
                    ) : isTracked ? (
                      <>
                        <Check size={15} />
                        <span>Tracked</span>
                      </>
                    ) : (
                      <>
                        <Plus size={15} />
                        <span>Track Price</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
