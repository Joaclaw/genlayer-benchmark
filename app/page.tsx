'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getContractResults } from '@/lib/genlayer';

export default function Home() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        const results = await getContractResults();
        
        const total = results.length;
        const resolvable = results.filter((r: any) => r.resolvable).length;
        const correct = results.filter((r: any) => r.correct).length;
        const consensusAchieved = results.filter((r: any) => 
          r.resolvable || r.failure_reason !== 'consensus_disagree'
        ).length;
        
        const byFailure: Record<string, number> = {};
        results.forEach((r: any) => {
          if (!r.resolvable && r.failure_reason) {
            byFailure[r.failure_reason] = (byFailure[r.failure_reason] || 0) + 1;
          }
        });
        
        setStats({
          total,
          resolvable,
          correct,
          consensusAchieved,
          accuracy: resolvable > 0 ? Math.round(correct / resolvable * 100) : 0,
          resolvableRate: Math.round(resolvable / total * 100),
          consensusRate: Math.round(consensusAchieved / total * 100),
          byFailure
        });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <div>Loading benchmark statistics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <div style={{ color: '#f85149', fontSize: '1.2rem', marginBottom: '1rem' }}>
          Error loading statistics
        </div>
        <div style={{ color: '#8b949e' }}>{error}</div>
      </div>
    );
  }

  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: '#58a6ff' }}>
          GenLayer Benchmark
        </h1>
        <p style={{ fontSize: '1.2rem', color: '#8b949e' }}>
          Testing Intelligent Contracts for Polymarket Resolution
        </p>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#58a6ff' }}>{stats.total}</div>
          <div className="stat-label">Markets Processed</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#3fb950' }}>{stats.resolvable}</div>
          <div className="stat-label">Resolvable ({stats.resolvableRate}%)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#3fb950' }}>{stats.correct}</div>
          <div className="stat-label">Correct ({stats.accuracy}%)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#58a6ff' }}>{stats.consensusAchieved}</div>
          <div className="stat-label">Consensus ({stats.consensusRate}%)</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '3rem' }}>
        <h2 style={{ marginBottom: '1.5rem' }}>Failure Breakdown</h2>
        {Object.entries(stats.byFailure).length > 0 ? (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {Object.entries(stats.byFailure)
              .sort((a, b) => (b[1] as number) - (a[1] as number))
              .map(([type, count]) => (
                <div key={type} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.5rem 0'
                }}>
                  <span style={{ fontFamily: 'monospace' }}>{type}</span>
                  <span style={{ color: '#8b949e' }}>{String(count)} markets</span>
                </div>
              ))}
          </div>
        ) : (
          <div style={{ color: '#8b949e' }}>All markets resolved successfully</div>
        )}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '2rem',
        marginTop: '3rem'
      }}>
        <Link href="/markets" className="card" style={{
          textAlign: 'center',
          padding: '3rem 2rem',
          transition: 'border-color 0.2s',
          display: 'block'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
          <h3 style={{ marginBottom: '0.5rem' }}>View Markets</h3>
          <p style={{ color: '#8b949e' }}>Browse the 2000 markets dataset</p>
        </Link>

        <Link href="/contract" className="card" style={{
          textAlign: 'center',
          padding: '3rem 2rem',
          transition: 'border-color 0.2s',
          display: 'block'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📜</div>
          <h3 style={{ marginBottom: '0.5rem' }}>Contract Code</h3>
          <p style={{ color: '#8b949e' }}>View the Intelligent Contract</p>
        </Link>

        <Link href="/results" className="card" style={{
          textAlign: 'center',
          padding: '3rem 2rem',
          transition: 'border-color 0.2s',
          display: 'block'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
          <h3 style={{ marginBottom: '0.5rem' }}>Analysis</h3>
          <p style={{ color: '#8b949e' }}>Detailed results & diagnostics</p>
        </Link>
      </div>
    </>
  );
}
