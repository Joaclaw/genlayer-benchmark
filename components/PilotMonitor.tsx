'use client';

import { useState, useEffect, useCallback } from 'react';

interface URLResponse {
  url: string;
  answer: string;
  reasoning: string;
  content_preview: string;
  error: string;
}

interface PilotResult {
  market_id: string;
  question: string;
  urls_used: string[];
  url_responses: URLResponse[];
  final_answer: string;
  expected: string;
  correct: boolean;
  consensus_count: number;
  urls_fetched: number;
  urls_failed: number;
  reasoning: string;
  timestamp: string;
  error?: string;
}

interface URLCandidate {
  url: string;
  title: string;
  confidence: number;
  accessible: boolean;
  validation_reason?: string;
}

interface URLDiscovery {
  market_id: string;
  question: string;
  expected: string;
  urls: URLCandidate[];
  accessible_count: number;
  search_results_count: number;
  error?: string;
}

interface PilotResultsData {
  generated_at: string;
  contract_address: string;
  pilot_count: number;
  submitted: number;
  results: PilotResult[];
}

interface PilotURLsData {
  generated_at: string;
  pilot_count: number;
  discoveries: URLDiscovery[];
  summary: {
    total: number;
    with_3_urls: number;
    with_2_urls: number;
    with_1_url: number;
    with_0_urls: number;
  };
}

const POLL_INTERVAL = 2000;

export default function PilotMonitor() {
  const [pilotResults, setPilotResults] = useState<PilotResultsData | null>(null);
  const [pilotURLs, setPilotURLs] = useState<PilotURLsData | null>(null);
  const [expandedMarket, setExpandedMarket] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'results' | 'urls'>('results');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isPolling, setIsPolling] = useState(true);
  const [prevResultCount, setPrevResultCount] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const [resultsRes, urlsRes] = await Promise.allSettled([
        fetch('/data/pilot_results.json', { cache: 'no-store' }),
        fetch('/data/pilot_urls.json', { cache: 'no-store' }),
      ]);

      if (resultsRes.status === 'fulfilled' && resultsRes.value.ok) {
        const data = await resultsRes.value.json();
        setPilotResults(prev => {
          if (prev) setPrevResultCount(prev.results?.length || 0);
          return data;
        });
      }

      if (urlsRes.status === 'fulfilled' && urlsRes.value.ok) {
        setPilotURLs(await urlsRes.value.json());
      }

      setLastUpdated(new Date());
    } catch {
      // Silently handle fetch errors (file may not exist yet)
    }
  }, []);

  useEffect(() => {
    fetchData();
    if (!isPolling) return;
    const interval = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData, isPolling]);

  // Compute stats
  const results = pilotResults?.results || [];
  const totalExpected = pilotResults?.pilot_count || pilotURLs?.pilot_count || 0;
  const resolved = results.filter(r => r.final_answer && r.final_answer !== 'UNCERTAIN' && !r.error);
  const correct = results.filter(r => r.correct === true);
  const uncertain = results.filter(r => r.final_answer === 'UNCERTAIN');
  const errors = results.filter(r => r.error);
  const accuracy = resolved.length > 0 ? Math.round((correct.length / resolved.length) * 100) : 0;
  const progressPct = totalExpected > 0 ? Math.round((results.length / totalExpected) * 100) : 0;
  const isComplete = totalExpected > 0 && results.length >= totalExpected;
  const hasNewResults = results.length > prevResultCount;

  const urlSummary = pilotURLs?.summary;

  // No data at all yet
  if (!pilotResults && !pilotURLs) {
    return (
      <div className="glass-card" style={{ padding: '2rem', borderLeft: '3px solid var(--accent-blue)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: 'var(--accent-blue)',
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 500, color: 'var(--text-main)' }}>
            Waiting for pilot data...
          </h3>
        </div>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
          Polling <code style={{ fontSize: '0.8rem', background: 'var(--bg-dark)', padding: '0.15rem 0.4rem', borderRadius: '3px' }}>/data/pilot_results.json</code> every 2s.
          Start the pilot script to see live results here.
        </p>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
      </div>
    );
  }

  return (
    <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
      {/* Live Header */}
      <div style={{
        padding: '1.25rem 2rem',
        borderBottom: '1px solid var(--border-color)',
        background: isComplete ? 'rgba(52,211,153,0.05)' : 'rgba(59,130,246,0.05)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {!isComplete && (
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: 'var(--accent-green)',
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
            )}
            <h3 style={{ fontSize: '1.1rem', fontWeight: 500, color: 'var(--text-main)', margin: 0 }}>
              {isComplete ? 'Pilot Complete' : 'Live Pilot Monitor'}
            </h3>
            {!isComplete && (
              <span style={{
                fontSize: '0.7rem',
                padding: '0.15rem 0.5rem',
                borderRadius: '10px',
                background: 'rgba(52,211,153,0.15)',
                color: 'var(--accent-green)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                LIVE
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {lastUpdated && (
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={() => setIsPolling(p => !p)}
              style={{
                padding: '0.3rem 0.7rem',
                fontSize: '0.7rem',
                background: 'transparent',
                border: `1px solid ${isPolling ? 'var(--accent-green)' : 'var(--text-dim)'}`,
                borderRadius: '4px',
                color: isPolling ? 'var(--accent-green)' : 'var(--text-dim)',
                cursor: 'pointer',
              }}
            >
              {isPolling ? 'Polling ON' : 'Polling OFF'}
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        {totalExpected > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
              <span style={{ color: 'var(--text-dim)' }}>
                {results.length} / {totalExpected} markets processed
              </span>
              <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{progressPct}%</span>
            </div>
            <div style={{
              height: 6,
              background: 'var(--bg-dark)',
              borderRadius: 3,
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${progressPct}%`,
                background: isComplete
                  ? 'var(--accent-green)'
                  : 'linear-gradient(90deg, var(--accent-blue), var(--accent-green))',
                borderRadius: 3,
                transition: 'width 0.5s ease',
              }} />
            </div>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: '1px',
        background: 'var(--border-color)',
        borderBottom: '1px solid var(--border-color)',
      }}>
        <StatCell label="Processed" value={results.length} color="var(--accent-blue)" />
        <StatCell label="Resolved" value={resolved.length} color="var(--accent-green)" />
        <StatCell label="Correct" value={resolved.length > 0 ? `${correct.length}/${resolved.length}` : '-'} color="var(--accent-green)" />
        <StatCell label="Accuracy" value={resolved.length > 0 ? `${accuracy}%` : '-'} color={accuracy >= 90 ? 'var(--accent-green)' : accuracy >= 70 ? '#fbbf24' : 'var(--accent-red)'} />
        <StatCell label="Uncertain" value={uncertain.length} color="#fbbf24" />
        <StatCell label="Errors" value={errors.length} color="var(--accent-red)" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
        <TabButton active={activeTab === 'results'} onClick={() => setActiveTab('results')} color="var(--accent-green)">
          Results ({results.length})
        </TabButton>
        <TabButton active={activeTab === 'urls'} onClick={() => setActiveTab('urls')} color="var(--accent-blue)">
          URL Discovery ({pilotURLs?.discoveries?.length || 0})
        </TabButton>
      </div>

      {/* Content */}
      <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
        {activeTab === 'results' && (
          results.length > 0 ? (
            <div>
              {results.map((result, i) => (
                <div key={result.market_id || i}>
                  <div
                    onClick={() => setExpandedMarket(expandedMarket === result.market_id ? null : result.market_id)}
                    style={{
                      padding: '1rem 2rem',
                      borderBottom: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      borderLeft: `3px solid ${
                        result.error ? 'var(--text-dim)' :
                        result.correct ? 'var(--accent-green)' :
                        result.final_answer === 'UNCERTAIN' ? '#fbbf24' :
                        'var(--accent-red)'
                      }`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                          {result.question}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                          Expected: <strong>{result.expected}</strong>
                          {' | '}
                          Got: <strong style={{
                            color: result.correct ? 'var(--accent-green)' :
                              result.final_answer === 'UNCERTAIN' ? '#fbbf24' :
                              'var(--accent-red)'
                          }}>{result.final_answer || 'N/A'}</strong>
                          {result.consensus_count !== undefined && ` | Consensus: ${result.consensus_count}/3`}
                        </div>
                      </div>
                      <span style={{
                        fontSize: '0.75rem',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '4px',
                        background: result.error ? 'rgba(136,136,136,0.1)' :
                          result.correct ? 'rgba(52,211,153,0.1)' :
                          result.final_answer === 'UNCERTAIN' ? 'rgba(251,191,36,0.1)' :
                          'rgba(248,113,113,0.1)',
                        color: result.error ? 'var(--text-dim)' :
                          result.correct ? 'var(--accent-green)' :
                          result.final_answer === 'UNCERTAIN' ? '#fbbf24' :
                          'var(--accent-red)',
                        whiteSpace: 'nowrap',
                      }}>
                        {result.error ? 'ERROR' : result.correct ? 'CORRECT' : result.final_answer === 'UNCERTAIN' ? 'UNCERTAIN' : 'WRONG'}
                      </span>
                    </div>
                  </div>

                  {expandedMarket === result.market_id && (
                    <div style={{
                      padding: '1.25rem 2rem',
                      background: 'rgba(255,255,255,0.02)',
                      borderBottom: '1px solid var(--border-color)',
                      borderLeft: '3px solid var(--border-color)',
                    }}>
                      {result.url_responses?.map((resp, j) => (
                        <div key={j} style={{
                          padding: '0.75rem',
                          background: 'var(--bg-dark)',
                          borderRadius: '6px',
                          marginBottom: '0.5rem',
                          fontSize: '0.8rem',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                            <span style={{ color: 'var(--accent-blue)', wordBreak: 'break-all' }}>
                              {resp.url}
                            </span>
                            <span style={{
                              color: resp.answer === 'YES' || resp.answer === 'NO'
                                ? 'var(--accent-green)' : 'var(--accent-red)',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                              marginLeft: '0.5rem',
                            }}>
                              {resp.answer}
                            </span>
                          </div>
                          {resp.reasoning && (
                            <div style={{ color: 'var(--text-dim)', lineHeight: 1.5 }}>
                              {resp.reasoning}
                            </div>
                          )}
                          {resp.error && (
                            <div style={{ color: 'var(--accent-red)' }}>
                              {resp.error}
                            </div>
                          )}
                        </div>
                      ))}
                      {result.error && (
                        <div style={{ color: 'var(--accent-red)', fontSize: '0.85rem' }}>
                          Error: {result.error}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.9rem' }}>
              No resolution results yet. Waiting for pilot to submit markets...
            </div>
          )
        )}

        {activeTab === 'urls' && pilotURLs?.discoveries && (
          <div>
            {pilotURLs.discoveries.map((discovery, i) => (
              <div key={discovery.market_id || i}>
                <div
                  onClick={() => setExpandedMarket(expandedMarket === `url-${discovery.market_id}` ? null : `url-${discovery.market_id}`)}
                  style={{
                    padding: '1rem 2rem',
                    borderBottom: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    borderLeft: `3px solid ${
                      discovery.accessible_count >= 3 ? 'var(--accent-green)' :
                      discovery.accessible_count > 0 ? '#fbbf24' :
                      'var(--accent-red)'
                    }`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                        {discovery.question}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                        {discovery.accessible_count} accessible URL(s) found
                        {discovery.urls.length > 0 && ` | ${discovery.urls.map(u => {
                          try { return new URL(u.url).hostname; } catch { return u.url; }
                        }).join(', ')}`}
                      </div>
                    </div>
                    <span style={{
                      fontSize: '0.75rem',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '4px',
                      background: discovery.accessible_count >= 3 ? 'rgba(52,211,153,0.1)' :
                        discovery.accessible_count > 0 ? 'rgba(251,191,36,0.1)' :
                        'rgba(248,113,113,0.1)',
                      color: discovery.accessible_count >= 3 ? 'var(--accent-green)' :
                        discovery.accessible_count > 0 ? '#fbbf24' :
                        'var(--accent-red)',
                      whiteSpace: 'nowrap',
                    }}>
                      {discovery.accessible_count}/3 URLs
                    </span>
                  </div>
                </div>

                {expandedMarket === `url-${discovery.market_id}` && (
                  <div style={{
                    padding: '1.25rem 2rem',
                    background: 'rgba(255,255,255,0.02)',
                    borderBottom: '1px solid var(--border-color)',
                    borderLeft: '3px solid var(--border-color)',
                  }}>
                    {discovery.urls.map((url, j) => (
                      <div key={j} style={{
                        padding: '0.75rem',
                        background: 'var(--bg-dark)',
                        borderRadius: '6px',
                        marginBottom: '0.5rem',
                        fontSize: '0.8rem',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--accent-blue)', wordBreak: 'break-all' }}>
                            {url.url}
                          </span>
                          <span style={{
                            color: url.accessible ? 'var(--accent-green)' : 'var(--accent-red)',
                            whiteSpace: 'nowrap',
                            marginLeft: '0.5rem',
                          }}>
                            {url.accessible ? `OK (${url.confidence.toFixed(2)})` : 'FAIL'}
                          </span>
                        </div>
                        {url.title && (
                          <div style={{ color: 'var(--text-dim)', marginTop: '0.25rem' }}>{url.title}</div>
                        )}
                        {url.validation_reason && (
                          <div style={{ color: 'var(--accent-red)', marginTop: '0.25rem' }}>{url.validation_reason}</div>
                        )}
                      </div>
                    ))}
                    {discovery.error && (
                      <div style={{ color: 'var(--accent-red)', fontSize: '0.85rem' }}>
                        Error: {discovery.error}
                      </div>
                    )}
                    {discovery.urls.length === 0 && !discovery.error && (
                      <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                        No accessible URLs found for this market.
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
    </div>
  );
}

function StatCell({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ padding: '1rem 1.25rem', background: 'var(--bg-card)' }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 300, color, letterSpacing: '-0.02em' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '0.25rem' }}>
        {label}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, color, children }: { active: boolean; onClick: () => void; color: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '0.75rem',
        background: 'transparent',
        border: 'none',
        borderBottom: active ? `2px solid ${color}` : '2px solid transparent',
        color: active ? 'var(--text-main)' : 'var(--text-dim)',
        fontWeight: active ? 500 : 400,
        cursor: 'pointer',
        fontSize: '0.85rem',
      }}
    >
      {children}
    </button>
  );
}
