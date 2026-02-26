'use client';

import { useEffect, useState } from 'react';
import { getContractResults } from '@/lib/genlayer';

export default function ResultsPage() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'resolvable' | 'failed'>('all');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    async function load() {
      try {
        const data = await getContractResults();
        setResults(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <div>Loading results from contract...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <div style={{ color: '#f85149', fontSize: '1.2rem', marginBottom: '1rem' }}>
          Error loading results
        </div>
        <div style={{ color: '#8b949e' }}>{error}</div>
      </div>
    );
  }

  const filtered = results.filter(r => {
    if (filter === 'resolvable') return r.resolvable;
    if (filter === 'failed') return !r.resolvable;
    return true;
  });

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  return (
    <>
      <h1 style={{ fontSize: '2rem', marginBottom: '2rem' }}>Analysis & Results</h1>

      <div style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '2rem',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={() => { setFilter('all'); setPage(1); }}
          style={{
            padding: '8px 16px',
            background: filter === 'all' ? '#58a6ff' : '#161b22',
            border: '1px solid #30363d',
            borderRadius: '6px',
            color: '#c9d1d9',
            cursor: 'pointer',
            fontWeight: filter === 'all' ? 'bold' : 'normal'
          }}
        >
          All ({results.length})
        </button>
        <button
          onClick={() => { setFilter('resolvable'); setPage(1); }}
          style={{
            padding: '8px 16px',
            background: filter === 'resolvable' ? '#3fb950' : '#161b22',
            border: '1px solid #30363d',
            borderRadius: '6px',
            color: '#c9d1d9',
            cursor: 'pointer',
            fontWeight: filter === 'resolvable' ? 'bold' : 'normal'
          }}
        >
          Resolvable ({results.filter(r => r.resolvable).length})
        </button>
        <button
          onClick={() => { setFilter('failed'); setPage(1); }}
          style={{
            padding: '8px 16px',
            background: filter === 'failed' ? '#f85149' : '#161b22',
            border: '1px solid #30363d',
            borderRadius: '6px',
            color: '#c9d1d9',
            cursor: 'pointer',
            fontWeight: filter === 'failed' ? 'bold' : 'normal'
          }}
        >
          Failed ({results.filter(r => !r.resolvable).length})
        </button>
      </div>

      <div style={{ display: 'grid', gap: '1.5rem' }}>
        {paginated.map((r, i) => (
          <div key={r.market_id || i} className="card">
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '1rem',
              gap: '1rem'
            }}>
              <h3 style={{ flex: 1 }}>{r.question}</h3>
              <span className={`badge ${
                r.resolvable && r.correct ? 'badge-success' :
                r.resolvable && !r.correct ? 'badge-error' :
                'badge-warning'
              }`}>
                {r.resolvable && r.correct ? '✓ Correct' :
                 r.resolvable && !r.correct ? '✗ Wrong' :
                 'Unresolvable'}
              </span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              marginBottom: '1rem',
              padding: '1rem',
              background: '#0d1117',
              borderRadius: '6px',
              fontSize: '0.9rem'
            }}>
              <div>
                <div style={{ color: '#8b949e', fontSize: '0.75rem', marginBottom: '4px' }}>
                  EXPECTED
                </div>
                <div>{r.polymarket_result}</div>
              </div>
              <div>
                <div style={{ color: '#8b949e', fontSize: '0.75rem', marginBottom: '4px' }}>
                  GENLAYER
                </div>
                <div>{r.genlayer_result}</div>
              </div>
              <div>
                <div style={{ color: '#8b949e', fontSize: '0.75rem', marginBottom: '4px' }}>
                  HTTP STATUS
                </div>
                <div>{r.status_code || 'N/A'}</div>
              </div>
              {r.failure_reason && (
                <div>
                  <div style={{ color: '#8b949e', fontSize: '0.75rem', marginBottom: '4px' }}>
                    FAILURE TYPE
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    {r.failure_reason}
                  </div>
                </div>
              )}
            </div>

            {r.error_detail && (
              <div style={{
                padding: '1rem',
                background: '#161b22',
                borderLeft: '3px solid #f85149',
                marginBottom: '1rem',
                fontSize: '0.9rem',
                color: '#f85149'
              }}>
                <strong>Error:</strong> {r.error_detail}
              </div>
            )}

            {r.reasoning && (
              <div style={{
                padding: '1rem',
                background: '#0d1117',
                borderLeft: '3px solid #58a6ff',
                fontSize: '0.9rem',
                lineHeight: '1.6'
              }}>
                <strong style={{ color: '#58a6ff' }}>Reasoning:</strong> {r.reasoning}
              </div>
            )}

            <div style={{
              marginTop: '1rem',
              fontSize: '0.85rem',
              color: '#8b949e'
            }}>
              <a href={r.resolution_url} target="_blank" rel="noopener noreferrer">
                {r.resolution_url}
              </a>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '1rem',
          marginTop: '3rem',
          alignItems: 'center'
        }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              padding: '8px 16px',
              background: '#161b22',
              border: '1px solid #30363d',
              borderRadius: '6px',
              color: '#c9d1d9',
              cursor: page === 1 ? 'not-allowed' : 'pointer',
              opacity: page === 1 ? 0.5 : 1
            }}
          >
            ← Previous
          </button>
          <span style={{ color: '#8b949e' }}>
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{
              padding: '8px 16px',
              background: '#161b22',
              border: '1px solid #30363d',
              borderRadius: '6px',
              color: '#c9d1d9',
              cursor: page === totalPages ? 'not-allowed' : 'pointer',
              opacity: page === totalPages ? 0.5 : 1
            }}
          >
            Next →
          </button>
        </div>
      )}
    </>
  );
}
