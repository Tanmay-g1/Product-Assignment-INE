import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { Calendar, DollarSign, Package } from 'lucide-react';

export default function PriceChart({ history = [], currency = 'INR' }) {
  if (!history || history.length === 0) {
    return (
      <div className="chart-empty glass-card">
        <DollarSign size={36} className="text-muted" />
        <p className="empty-title">No Price History Recorded Yet</p>
        <p className="empty-subtitle">
          Prices are recorded automatically during scheduled scrapes every 2 hours.
        </p>
      </div>
    );
  }

  // Reverse history so it graphs chronologically from left (oldest) to right (newest)
  const chartData = [...history]
    .sort((a, b) => new Date(a.scraped_at) - new Date(b.scraped_at))
    .map((item) => {
      const dateObj = new Date(item.scraped_at);
      return {
        timestamp: dateObj.toLocaleDateString('en-IN', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        fullDate: dateObj.toLocaleString('en-IN'),
        price: Number(item.price),
        stock: item.stock ?? 0,
        currency: item.currency || currency
      };
    });

  const minPrice = Math.min(...chartData.map((d) => d.price));
  const maxPrice = Math.max(...chartData.map((d) => d.price));
  const yDomain = [
    Math.floor(minPrice * 0.95),
    Math.ceil(maxPrice * 1.05)
  ];

  return (
    <div className="glass-card chart-card">
      <div className="chart-header">
        <div>
          <h3 className="section-title">Price & Stock History</h3>
          <p className="section-subtitle">Chronological ground-truth timeline from intercepted API data</p>
        </div>
        <div className="chart-stats-pill">
          <span className="stat-pill-item">
            <span className="dot dot-blue"></span> Price ({currency})
          </span>
          <span className="stat-pill-item">
            <span className="dot dot-green"></span> Stock Count
          </span>
        </div>
      </div>

      <div style={{ width: '100%', height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 15, right: 25, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.07)" vertical={false} />
            <XAxis
              dataKey="timestamp"
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
            />
            <YAxis
              yAxisId="price"
              stroke="#60a5fa"
              fontSize={12}
              tickLine={false}
              domain={yDomain}
              axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
              tickFormatter={(val) => `₹${val}`}
            />
            <YAxis
              yAxisId="stock"
              orientation="right"
              stroke="#34d399"
              fontSize={12}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
              tickFormatter={(val) => `${val} qty`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="custom-tooltip glass-card">
                      <div className="tooltip-date">
                        <Calendar size={13} />
                        <span>{data.fullDate}</span>
                      </div>
                      <div className="tooltip-row price-row">
                        <span>Price:</span>
                        <strong>{data.currency} ₹{data.price.toLocaleString()}</strong>
                      </div>
                      <div className="tooltip-row stock-row">
                        <span>Stock:</span>
                        <strong>{data.stock > 0 ? `${data.stock} units` : 'Out of Stock'}</strong>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="price"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={{ r: 4, fill: '#3b82f6', stroke: '#1d4ed8', strokeWidth: 1 }}
              activeDot={{ r: 7, fill: '#60a5fa', stroke: '#ffffff', strokeWidth: 2 }}
              name={`Price (${currency})`}
            />
            <Line
              yAxisId="stock"
              type="stepAfter"
              dataKey="stock"
              stroke="#10b981"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={{ r: 3, fill: '#10b981' }}
              name="Stock Quantity"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
