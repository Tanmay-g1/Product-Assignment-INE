import React from 'react';

export default function App() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div className="glass-card" style={{ maxWidth: '640px', width: '100%', padding: '2.5rem', textAlign: 'center' }}>
        <div className="badge badge-success" style={{ marginBottom: '1rem' }}>Phase 1 Initialized</div>
        <h1 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '1rem', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          INE Product Price Tracker
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
          Automated web scraper with Proof-of-Work challenge solver, telemetry logs, and scheduled historical tracking.
        </p>
      </div>
    </div>
  );
}
