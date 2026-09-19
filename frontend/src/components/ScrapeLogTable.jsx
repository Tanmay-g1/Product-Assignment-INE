import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Clock, RotateCcw } from 'lucide-react';

export default function ScrapeLogTable({ logs = [] }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="glass-card table-empty">
        <Clock size={32} className="text-muted" />
        <p className="empty-title">No Scrape Logs Recorded</p>
        <p className="empty-subtitle">
          Attempts, including failures and retry backoffs, will appear here honestly.
        </p>
      </div>
    );
  }

  const renderBadge = (outcome) => {
    switch (outcome) {
      case 'success':
        return (
          <span className="badge badge-success">
            <CheckCircle2 size={13} />
            SUCCESS
          </span>
        );
      case 'retried':
        return (
          <span className="badge badge-warning">
            <RotateCcw size={13} />
            RETRIED
          </span>
        );
      case 'failed':
      default:
        return (
          <span className="badge badge-danger">
            <XCircle size={13} />
            FAILED
          </span>
        );
    }
  };

  return (
    <div className="glass-card log-table-card">
      <div className="table-header">
        <div>
          <h3 className="section-title">Transparent Scrape Audit Log</h3>
          <p className="section-subtitle">
            Complete record of every attempt — including transient 503s, timeouts, and failures (none hidden)
          </p>
        </div>
        <div className="log-count-tag">
          {logs.length} Attempt{logs.length === 1 ? '' : 's'} Logged
        </div>
      </div>

      <div className="table-wrapper">
        <table className="log-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Outcome</th>
              <th>Attempt #</th>
              <th>Duration</th>
              <th>Diagnostic Detail / Reason</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
              const isFailure = log.outcome === 'failed';
              const isRetry = log.outcome === 'retried';
              const rowClass = isFailure ? 'row-failed' : isRetry ? 'row-retried' : 'row-success';

              return (
                <tr key={log.id} className={rowClass}>
                  <td className="log-date">
                    {new Date(log.attempted_at).toLocaleString('en-IN', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </td>
                  <td>{renderBadge(log.outcome)}</td>
                  <td>
                    <span className="attempt-pill">
                      Attempt {log.attempt_number}
                    </span>
                  </td>
                  <td className="font-mono text-muted">
                    {log.duration_ms ? `${log.duration_ms}ms` : '—'}
                  </td>
                  <td className="log-detail">
                    <span className={isFailure ? 'text-danger-bold' : ''}>
                      {log.detail || 'Completed successfully'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
