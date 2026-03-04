import React from 'react';
import { getMarketData } from '@/lib/data';

export default async function PolyMarketPage() {
  let marketData;
  try {
    marketData = await getMarketData();
  } catch (e) {
    return <div className="content-box">Data missing. Ensure data/polymarket_2000_sample.json exists.</div>;
  }
  const markets = marketData.markets || [];

  return (
    <div className="content-wrapper">
      <header style={{ marginBottom: '4rem' }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '1rem', fontWeight: 200, letterSpacing: '-0.04em' }}>PolyMarket Data</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '1.2rem', maxWidth: '800px', lineHeight: 1.6, fontWeight: 300 }}>
          A direct feed of the base fetched markets acting as our ground truth dataset. Displaying {markets.length} entries.
        </p>
      </header>

      <div className="glass-card" style={{ padding: 0, overflow: 'hidden', width: '100%' }}>
        <div className="data-table-container" style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
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
              {markets.slice(0, 500).map((market: any, index: number) => (
                <tr key={market.id || index}>
                  <td style={{ paddingLeft: '2rem', color: 'var(--text-dim)', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                    {market.id.substring(0, 30)}...
                  </td>
                  <td style={{ fontWeight: 400, color: 'var(--text-main)', fontSize: '1rem' }}>{market.question}</td>
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
        <div style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid var(--border-color)', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-dim)', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
          Display bounded to initial 500 records for immediate viewport rendering
        </div>
      </div>
    </div>
  );
}
