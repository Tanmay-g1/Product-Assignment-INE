import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import SearchPage from './pages/SearchPage';
import ProductDetail from './pages/ProductDetail';
import { api } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'search' | 'detail'
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [trackedProducts, setTrackedProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchTrackedProducts = async () => {
    setLoading(true);
    try {
      const prods = await api.getTrackedProducts();
      setTrackedProducts(prods);
    } catch (err) {
      console.error('Failed to load tracked products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrackedProducts();
  }, []);

  const handleSelectProduct = (productId) => {
    setSelectedProductId(productId);
    setActiveTab('detail');
  };

  const handleBackToDashboard = () => {
    setSelectedProductId(null);
    setActiveTab('dashboard');
    fetchTrackedProducts();
  };

  const handleProductTracked = (productId) => {
    fetchTrackedProducts();
    setSelectedProductId(productId);
    setActiveTab('detail');
  };

  const trackedIdsSet = new Set(trackedProducts.map((p) => Number(p.productId)));

  return (
    <div className="app-wrapper">
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setSelectedProductId(null);
          setActiveTab(tab);
          if (tab === 'dashboard') {
            fetchTrackedProducts();
          }
        }}
        trackedCount={trackedProducts.length}
      />

      <main>
        {activeTab === 'dashboard' && (
          <Dashboard
            products={trackedProducts}
            loading={loading}
            onRefresh={fetchTrackedProducts}
            onSelectProduct={handleSelectProduct}
            onGoToSearch={() => setActiveTab('search')}
          />
        )}

        {activeTab === 'search' && (
          <SearchPage
            trackedIds={trackedIdsSet}
            onProductTracked={handleProductTracked}
          />
        )}

        {activeTab === 'detail' && selectedProductId && (
          <ProductDetail
            productId={selectedProductId}
            onBack={handleBackToDashboard}
          />
        )}
      </main>
    </div>
  );
}
