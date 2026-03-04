import React from 'react';
import StatCard from '@/components/StatCard';
import TabbedResults from '@/components/TabbedResults';
import { getResultsData } from '@/lib/data';

export default async function AnalysisResultsPage() {
  let resultData;
  try {
    resultData = await getResultsData();
  } catch (e) {
    return (
      <div className="content-box">
        <strong>Data synchronization issue:</strong> Benchmark results file missing.
        Please ensure <code>benchmark_results.json</code> exists in the data directory.
      </div>
    );
  }

  const results = resultData.results || [];

  // Compute detailed breakdown from results
  const resolved = results.filter((r: any) => !r.failure_reason || r.failure_reason === '');
  const correct = resolved.filter((r: any) => r.correct);
  const incorrect = resolved.filter((r: any) => !r.correct);

  const webAccessIssues = results.filter((r: any) => r.failure_reason?.startsWith('web_'));
  const contentIssues = results.filter((r: any) => r.failure_reason?.startsWith('content_'));
  const llmUnresolvable = results.filter((r: any) => r.failure_reason?.startsWith('llm_'));

  // Detailed web access breakdown
  const webForbidden = results.filter((r: any) => r.failure_reason === 'web_forbidden').length;
  const webTimeout = results.filter((r: any) => r.failure_reason === 'web_timeout').length;
  const webServerError = results.filter((r: any) => r.failure_reason === 'web_server_error').length;
  const webConnectionError = results.filter((r: any) => r.failure_reason === 'web_connection_error').length;
  const webUnknownError = results.filter((r: any) => r.failure_reason === 'web_unknown_error').length;
  const webNotFound = results.filter((r: any) => r.failure_reason === 'web_not_found').length;

  // Detailed content breakdown
  const contentEmpty = results.filter((r: any) => r.failure_reason === 'content_empty').length;
  const contentInsufficient = results.filter((r: any) => r.failure_reason === 'content_insufficient').length;
  const contentAntiBot = results.filter((r: any) => r.failure_reason === 'content_anti_bot').length;

  const accuracy = resolved.length > 0 ? Math.round((correct.length / resolved.length) * 1000) / 10 : 0;

  // Convert contract outputs safely to the interface TabbedResults expects
  const formattedResults = results.map((r: any) => ({
    market_id: r.market_id,
    question: r.question,
    expected: r.polymarket_result,
    genlayer: r.genlayer_result,
    correct: r.correct,
    resolvable: r.resolvable,
    reasoning: r.reasoning || '',
    failure_reason: r.failure_reason || ''
  }));

  return (
    <div className="content-wrapper">
      <header style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '1rem', fontWeight: 200, letterSpacing: '-0.04em' }}>Analysis & Results</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '1.2rem', maxWidth: '800px', lineHeight: 1.6, fontWeight: 300 }}>
          Evaluating GenLayer&apos;s resolutions against exactly {results.length} closed markets, filtering noise from actionable insight.
        </p>
      </header>

      {/* Summary Stats Row */}
      <h2 style={{ fontSize: '1.25rem', fontWeight: 400, marginBottom: '1.5rem', color: 'var(--text-main)', letterSpacing: '0.02em', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>Resolution Summary</h2>
      <div className="dashboard-grid" style={{ marginBottom: '3rem' }}>
        <StatCard
          title="Successfully Resolved"
          value={resolved.length.toString()}
          subtitle={`${correct.length} correct, ${incorrect.length} incorrect (${accuracy}% accuracy)`}
          type="success"
        />
        <StatCard
          title="Web Access Issues"
          value={webAccessIssues.length.toString()}
          subtitle="Server errors, 403s, timeouts, connection failures"
          type="error"
        />
        <StatCard
          title="Content Issues"
          value={contentIssues.length.toString()}
          subtitle="Empty pages, anti-bot blocks, insufficient data"
          type="warning"
        />
        <StatCard
          title="LLM Unresolvable"
          value={llmUnresolvable.length.toString()}
          subtitle="Ambiguous or insufficient information for resolution"
          type="neutral"
        />
      </div>

      {/* Detailed Breakdown */}
      <h2 style={{ fontSize: '1.25rem', fontWeight: 400, marginBottom: '1.5rem', color: 'var(--text-main)', letterSpacing: '0.02em', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>Failure Breakdown</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '4rem' }}>

        {/* Web Access Details */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 500, color: '#ef4444', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Web Access Issues ({webAccessIssues.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-dim)' }}>403 Forbidden</span>
              <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{webForbidden}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-dim)' }}>Server Errors</span>
              <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{webServerError}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-dim)' }}>Unknown Errors</span>
              <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{webUnknownError}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-dim)' }}>Timeouts</span>
              <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{webTimeout}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-dim)' }}>Connection Errors</span>
              <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{webConnectionError}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-dim)' }}>404 Not Found</span>
              <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{webNotFound}</span>
            </div>
          </div>
        </div>

        {/* Content Details */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 500, color: '#fbbf24', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Content Issues ({contentIssues.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-dim)' }}>Empty Content</span>
              <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{contentEmpty}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-dim)' }}>Insufficient Data</span>
              <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{contentInsufficient}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-dim)' }}>Anti-Bot Blocks</span>
              <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{contentAntiBot}</span>
            </div>
          </div>
        </div>

        {/* Resolution Quality */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 500, color: '#22c55e', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resolution Quality ({resolved.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-dim)' }}>Correct Resolutions</span>
              <span style={{ color: '#22c55e', fontWeight: 500 }}>{correct.length}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-dim)' }}>Incorrect Resolutions</span>
              <span style={{ color: '#ef4444', fontWeight: 500 }}>{incorrect.length}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>Accuracy Rate</span>
              <span style={{ color: '#22c55e', fontWeight: 600 }}>{accuracy}%</span>
            </div>
          </div>
        </div>

      </div>

      {/* Bottom Section Tabbed Interactive Data */}
      <h2 style={{ fontSize: '1.25rem', fontWeight: 400, marginBottom: '1.5rem', color: 'var(--text-main)', letterSpacing: '0.02em', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>Interactive Market Breakdowns</h2>

      <div style={{ width: '100%' }}>
        <TabbedResults results={formattedResults} />
      </div>

    </div>
  );
}
