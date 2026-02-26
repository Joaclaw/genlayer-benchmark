'use client';

import { useEffect, useState } from 'react';
import { getContractResults } from '@/lib/genlayer';

export default function ResultsPage() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'resolvable' | 'failed'>('all');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    async function load() {
      try {
        const data = await getContractResults();
        setResults(data);
      } catch (err: any) {
        console.error('Error loading results:', err);
        setError(err.message || 'Failed to load results from contract');
      } finally {
        setLoading(false);
      }
    }
    
    load();
  }, [mounted]);

  if (!mounted) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <div>Initializing...</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <div>Loading results...</div>
      </div>
    );
  }

  if (error) {
    return (
      <>
        <h1 style={{ fontSize: '2rem', marginBottom: '2rem' }}>Results Analysis</h1>
        <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <div style={{ color: '#f85149', fontSize: '1.2rem', marginBottom: '1rem' }}>
            Error loading results
          </div>
          <div style={{ color: '#8b949e', marginBottom: '2rem' }}>{error}</div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 24px',
              background: '#238636',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '1rem',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Retry
          </button>
        </div>
      </>
    );
  }

  if (results.length === 0 && !loading) {
    return (
      <>
        <h1 style={{ fontSize: '2rem', marginBottom: '2rem' }}>Results Analysis</h1>
        <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <div style={{ fontSize: '1.2rem', marginBottom: '1rem', color: '#8b949e' }}>
            No results yet
          </div>
          <div style={{ color: '#6e7681' }}>
            Markets are being processed. Check back in a few minutes.
          </div>
        </div>
      </>
    );
  }

  const filtered = results.filter(r => {
    if (filter === 'resolvable') return r.resolvable;
    if (filter === 'failed') return !r.resolvable;
    return true;
  });

  return (
    <>
      <h1 style={{ fontSize: '2rem', marginBottom: '2rem' }}>Results Analysis</h1>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setFilter('all')}
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
          onClick={() => setFilter('resolvable')}
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
          ✓ Resolvable ({results.filter(r => r.resolvable).length})
        </button>
        <button
          onClick={() => setFilter('failed')}
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
          ✗ Failed ({results.filter(r => !r.resolvable).length})
        </button>
      </div>

      <div style={{ display: 'grid', gap: '12px' }}>
        {filtered.map((r, i) => {
          const isCorrect = r.resolvable && r.correct;
          const isWrong = r.resolvable && !r.correct;
          
          return (
            <div 
              key={r.market_id || i} 
              style={{
                background: '#161b22',
                border: `1px solid ${isCorrect ? '#3fb950' : isWrong ? '#f85149' : '#30363d'}`,
                borderRadius: '6px',
                padding: '16px',
                display: 'grid',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                <div style={{ flex: 1, fontSize: '1rem', lineHeight: '1.5' }}>
                  {r.question}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    background: r.polymarket_result === 'Yes' ? '#238636' : r.polymarket_result === 'No' ? '#7d4e57' : '#6e7681',
                    color: '#fff'
                  }}>
                    Expected: {r.polymarket_result}
                  </span>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    background: isCorrect ? '#238636' : isWrong ? '#da3633' : '#6e7681',
                    color: '#fff'
                  }}>
                    {isCorrect ? '✓ ' + r.genlayer_result : isWrong ? '✗ ' + r.genlayer_result : r.failure_reason.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {r.reasoning && (
                <div style={{
                  fontSize: '0.9rem',
                  color: '#8b949e',
                  paddingTop: '8px',
                  borderTop: '1px solid #30363d',
                  lineHeight: '1.5'
                }}>
                  {r.reasoning}
                </div>
              )}

              {r.error_detail && (
                <div style={{
                  fontSize: '0.9rem',
                  color: '#f85149',
                  paddingTop: '8px',
                  borderTop: '1px solid #30363d'
                }}>
                  Error: {r.error_detail}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#8b949e' }}>
          No results match this filter
        </div>
      )}
    </>
  );
}
