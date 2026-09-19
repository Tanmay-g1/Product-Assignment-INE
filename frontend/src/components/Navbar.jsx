import React from 'react';
import { Activity, Search, LayoutDashboard, Database } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, trackedCount }) {
  return (
    <header className="navbar-container">
      <div className="navbar-content">
        <div className="navbar-brand" onClick={() => setActiveTab('dashboard')} style={{ cursor: 'pointer' }}>
          <div className="brand-icon">
            <Activity size={20} className="icon-pulse" />
          </div>
          <div>
            <div className="brand-title">INE Price Tracker</div>
            <div className="brand-subtitle">Autonomous Resilient Scraper</div>
          </div>
        </div>

        <nav className="navbar-nav">
          <button
            type="button"
            className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={17} />
            <span>Dashboard</span>
            {trackedCount > 0 && <span className="nav-badge">{trackedCount}</span>}
          </button>

          <button
            type="button"
            className={`nav-btn ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            <Search size={17} />
            <span>Search & Track</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
