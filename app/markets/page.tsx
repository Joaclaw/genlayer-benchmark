'use client';

import { useEffect, useState } from 'react';
import marketsData from '@/data/polymarket_2000_sample.json';

export default function MarketsPage() {
  const [markets, setMarkets] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    setMarkets(marketsData.markets || []);
  }, []);

  const filtered = markets.filter(m =>
    m.question.toLowerCase().includes(search.toLowerCase())
  );

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  return (
    <>
      <h1 style={{ fontSize: '2rem', marginBottom: '2rem' }}>Markets Dataset</h1>

      <div style={{ marginBottom: '2rem' }}>
        <input
          type="text"
          placeholder="Search markets..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          style={{
            width: '100%',
            padding: '12px 16px',
            background: '#161b22',
            border: '1px solid #30363d',
            borderRadius: '6px',
            color: '#c9d1d9',
            fontSize: '1rem'
          }}
        />
      </div>

      <div style={{
        marginBottom: '1rem',
        color: '#8b949e',
        fontSize: '0.9rem'
      }}>
        Showing {paginated.length} of {filtered.length} markets
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Question</th>
              <th>Outcome</th>
              <th>Category</th>
              <th>End Date</th>
              <th>Resolution URL</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((m, i) => (
              <tr key={m.id}>
                <td>{(page - 1) * pageSize + i + 1}</td>
                <td style={{ maxWidth: '400px' }}>{m.question}</td>
                <td>
                  <span className={`badge ${
                    m.outcome === 'Yes' ? 'badge-success' : 
                    m.outcome === 'No' ? 'badge-error' : 'badge-secondary'
                  }`}>
                    {m.outcome}
                  </span>
                </td>
                <td style={{ textTransform: 'capitalize' }}>{m.category}</td>
                <td>{m.end_date ? m.end_date.split('T')[0] : '-'}</td>
                <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {m.resolution_url ? (
                    <a href={m.resolution_url} target="_blank" rel="noopener noreferrer">
                      {m.resolution_url.slice(0, 50)}...
                    </a>
                  ) : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '1rem',
          marginTop: '2rem',
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
