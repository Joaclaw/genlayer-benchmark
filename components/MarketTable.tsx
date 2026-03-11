'use client';
import React, { useState, useMemo } from 'react';

interface Market {
  id: string;
  question: string;
  category: string;
  outcome: string;
}

const PAGE_SIZE = 50;

export default function MarketTable({ markets }: { markets: Market[] }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!search) return markets;
    const q = search.toLowerCase();
    return markets.filter(m =>
      m.question?.toLowerCase().includes(q) ||
      m.id?.toLowerCase().includes(q) ||
      m.category?.toLowerCase().includes(q)
    );
  }, [markets, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <>
      <div style={{ marginBottom: '1.5rem', position: 'relative' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }}>
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          type="text"
          className="search-input"
          placeholder="Search by question, ID, or category..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        />
      </div>

      <div className="glass-card" style={{ padding: 0, overflow: 'hidden', width: '100%' }}>
        <div className="data-table-container" style={{ maxHeight: 'calc(100vh - 340px)', overflowY: 'auto' }}>
          <table className="data-table" style={{ margin: 0 }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 10 }}>
              <tr>
                <th style={{ paddingLeft: '2rem', width: '20%' }}>Market ID</th>
                <th style={{ width: '50%' }}>Question</th>
                <th style={{ width: '15%' }}>Category</th>
                <th style={{ paddingRight: '2rem', width: '15%' }}>Expected Result</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((market, index) => (
                <tr key={market.id || `${page}-${index}`}>
                  <td style={{ paddingLeft: '2rem', color: 'var(--text-dim)', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                    <div className="truncate" title={market.id}>
                      {market.id}
                    </div>
                  </td>
                  <td style={{ fontWeight: 400, color: 'var(--text-main)', fontSize: '1rem' }}>
                    <div className="truncate" title={market.question}>
                      {market.question}
                    </div>
                  </td>
                  <td>
                    <span className="badge neutral" style={{ textTransform: 'capitalize' }}>
                      {market.category}
                    </span>
                  </td>
                  <td style={{ paddingRight: '2rem' }}>
                    <span className={`badge ${market.outcome?.toLowerCase() === 'yes' ? 'success' : 'error'}`}>
                      {market.outcome}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <button disabled={page === 0} onClick={() => setPage(0)}>First</button>
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</button>
            <span>
              Page {page + 1} of {totalPages} ({filtered.length} markets)
            </span>
            <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</button>
            <button disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>Last</button>
          </div>
        )}

        {paged.length === 0 && (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-dim)' }}>
            {search ? `No markets matching "${search}"` : 'No market data available.'}
          </div>
        )}
      </div>
    </>
  );
}
