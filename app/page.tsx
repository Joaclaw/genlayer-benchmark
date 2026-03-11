import React from 'react';
import { getMarketData } from '@/lib/data';
import MarketTable from '@/components/MarketTable';

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

      <MarketTable markets={markets} />
    </div>
  );
}
