'use client';
import { useState, useEffect } from 'react';

interface Resolution {
  filename: string;
  market: {
    id: string;
    question: string;
    description: string;
    outcome: string;
    end_date: string;
    resolved: boolean;
    slug: string;
    image?: string;
  };
  discoveredUrls: Array<{
    url: string;
    title: string;
    domain: string;
    relevance_score: number;
    highlight?: string;
  }>;
  validatedUrls: Array<{
    url: string;
    title: string;
    domain: string;
    accessible: boolean;
    relevant: boolean;
    answerBearing?: boolean;
    snippet?: string;
    error?: string;
  }>;
  selectedUrls: string[];
  result: {
    market_id: string;
    question: string;
    urls_used: string[];
    final_answer: string;
    expected: string;
    correct: boolean;
    reasoning: string;
    urls_fetched: number;
    consensus: {
      status: string;
      result: string;
      agree_count: number;
      total_validators: number;
      votes: string[];
    };
  };
  timestamp: string;
  logs: string[];
}

const ChevronDown = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);

const ChevronUp = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="18 15 12 9 6 15"></polyline>
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const QuestionIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"></circle>
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
  </svg>
);

function ResolutionCard({ resolution, isExpanded, onToggle }: {
  resolution: Resolution;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { market, result, timestamp, discoveredUrls, validatedUrls, selectedUrls, logs } = resolution;
  const isCorrect = result?.correct;
  const isUncertain = result?.final_answer === 'UNCERTAIN';

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = () => {
    if (isUncertain) return 'var(--yellow)';
    return isCorrect ? 'var(--green)' : 'var(--red)';
  };

  const getStatusLabel = () => {
    if (isUncertain) return 'UNCERTAIN';
    return isCorrect ? 'CORRECT' : 'INCORRECT';
  };

  const StatusIcon = () => {
    if (isUncertain) return <QuestionIcon />;
    return isCorrect ? <CheckIcon /> : <XIcon />;
  };

  return (
    <div
      style={{
        border: `1px solid ${isExpanded ? getStatusColor() : 'var(--border)'}`,
        borderLeft: `3px solid ${getStatusColor()}`,
        marginBottom: '0.5rem',
        background: 'var(--bg-dark)',
        transition: 'all 0.15s ease',
      }}
    >
      {/* Collapsed Header */}
      <div
        onClick={onToggle}
        style={{
          padding: '1rem 1.25rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        {/* Status Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: getStatusColor(),
            fontSize: '0.75rem',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            minWidth: '100px',
          }}
        >
          <StatusIcon />
          {getStatusLabel()}
        </div>

        {/* Question */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{
            fontSize: '0.9rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {market.question}
          </div>
        </div>

        {/* Meta Info */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          color: 'var(--text-dim)',
          fontSize: '0.75rem',
        }}>
          {/* Answer vs Expected */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ color: getStatusColor() }}>{result?.final_answer || '?'}</span>
            <span style={{ color: 'var(--text-dim)' }}>vs</span>
            <span style={{ color: 'var(--text-dim)' }}>{result?.expected || '?'}</span>
          </div>

          {/* Consensus */}
          <div>
            {result?.consensus?.agree_count || 0}/{result?.consensus?.total_validators || 0}
          </div>

          {/* Timestamp */}
          <div style={{ minWidth: '90px', textAlign: 'right' }}>
            {formatDate(timestamp)}
          </div>

          {/* Expand Icon */}
          <div style={{ color: 'var(--text-dim)' }}>
            {isExpanded ? <ChevronUp /> : <ChevronDown />}
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div style={{
          padding: '0 1.25rem 1.25rem',
          borderTop: '1px solid var(--border)',
        }}>
          {/* Main Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1.5rem',
            marginTop: '1.25rem',
          }}>
            {/* Left Column: Market Info */}
            <div>
              <SectionLabel>Market</SectionLabel>
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '1rem', marginBottom: '0.75rem', lineHeight: 1.4 }}>
                  {market.question}
                </div>
                {market.description && (
                  <div style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-dim)',
                    lineHeight: 1.5,
                    maxHeight: '100px',
                    overflow: 'auto',
                  }}>
                    {market.description}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
                <MetaItem label="Expected" value={market.outcome} color={market.outcome === 'Yes' ? 'var(--green)' : 'var(--red)'} />
                <MetaItem label="End Date" value={formatDate(market.end_date)} />
                <MetaItem label="Status" value={market.resolved ? 'Resolved' : 'Open'} />
              </div>
            </div>

            {/* Right Column: Result */}
            <div>
              <SectionLabel>Resolution Result</SectionLabel>
              <div style={{
                padding: '1rem',
                border: `1px solid ${getStatusColor()}`,
                background: `${getStatusColor()}08`,
                marginBottom: '1rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: getStatusColor() }}>
                    {result?.final_answer || 'N/A'}
                  </div>
                  <div style={{
                    padding: '0.25rem 0.75rem',
                    border: `1px solid ${getStatusColor()}`,
                    color: getStatusColor(),
                    fontSize: '0.7rem',
                    textTransform: 'uppercase',
                  }}>
                    {getStatusLabel()}
                  </div>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                  Expected: <span style={{ color: result?.expected === 'Yes' ? 'var(--green)' : 'var(--red)' }}>{result?.expected}</span>
                </div>
              </div>

              {/* Consensus */}
              <SectionLabel>Consensus</SectionLabel>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', fontSize: '0.8rem' }}>
                <MetaItem label="Status" value={result?.consensus?.status || 'N/A'} />
                <MetaItem label="Result" value={result?.consensus?.result || 'N/A'} />
                <MetaItem
                  label="Agreement"
                  value={`${result?.consensus?.agree_count || 0}/${result?.consensus?.total_validators || 0}`}
                />
              </div>
              {result?.consensus?.votes && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {result.consensus.votes.map((vote, i) => (
                    <span
                      key={i}
                      style={{
                        padding: '0.2rem 0.5rem',
                        fontSize: '0.7rem',
                        border: '1px solid',
                        borderColor: vote === 'AGREE' ? 'var(--green)' : 'var(--red)',
                        color: vote === 'AGREE' ? 'var(--green)' : 'var(--red)',
                      }}
                    >
                      V{i + 1}: {vote}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Reasoning */}
          {result?.reasoning && (
            <div style={{ marginTop: '1.5rem' }}>
              <SectionLabel>Reasoning</SectionLabel>
              <div style={{
                padding: '1rem',
                background: 'var(--bg-black)',
                border: '1px solid var(--border)',
                fontSize: '0.85rem',
                lineHeight: 1.6,
                color: 'var(--text)',
              }}>
                {result.reasoning}
              </div>
            </div>
          )}

          {/* URLs Section */}
          <div style={{ marginTop: '1.5rem' }}>
            <SectionLabel>URLs ({selectedUrls?.length || 0} selected / {discoveredUrls?.length || 0} discovered)</SectionLabel>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {validatedUrls?.map((url, i) => (
                <div
                  key={i}
                  style={{
                    padding: '0.75rem',
                    background: 'var(--bg-black)',
                    border: '1px solid var(--border)',
                    borderLeft: `2px solid ${url.accessible && url.relevant ? 'var(--green)' : 'var(--red)'}`,
                    fontSize: '0.8rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <a
                        href={url.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: 'var(--blue)',
                          marginBottom: '0.25rem',
                          display: 'block',
                          textDecoration: 'none',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                        onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                      >
                        {url.domain}
                      </a>
                      <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>{url.title}</div>
                      {url.snippet && (
                        <div style={{
                          marginTop: '0.5rem',
                          padding: '0.5rem',
                          background: 'var(--bg-dark)',
                          fontSize: '0.75rem',
                          fontStyle: 'italic',
                          color: 'var(--text-dim)',
                        }}>
                          "{url.snippet}"
                        </div>
                      )}
                    </div>
                    <div style={{
                      display: 'flex',
                      gap: '0.5rem',
                      marginLeft: '1rem',
                    }}>
                      {url.accessible ? (
                        <Tag color="var(--green)">OK</Tag>
                      ) : (
                        <Tag color="var(--red)">{url.error || 'FAIL'}</Tag>
                      )}
                      {url.answerBearing && <Tag color="var(--yellow)">ANSWER</Tag>}
                      {selectedUrls?.includes(url.url) && <Tag color="var(--blue)">USED</Tag>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Logs */}
          {logs && logs.length > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              <SectionLabel>Execution Log</SectionLabel>
              <div className="terminal" style={{ maxHeight: '150px' }}>
                {logs.map((log, i) => {
                  const [type, message] = log.split('|');
                  return (
                    <p key={i} className={`line ${type}`}>
                      {message || log}
                    </p>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '0.7rem',
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      color: 'var(--text-dim)',
      marginBottom: '0.75rem',
    }}>
      {children}
    </div>
  );
}

function MetaItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <span style={{ color: 'var(--text-dim)' }}>{label}: </span>
      <span style={{ color: color || 'var(--text)' }}>{value}</span>
    </div>
  );
}

function Tag({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{
      padding: '0.15rem 0.4rem',
      fontSize: '0.65rem',
      border: `1px solid ${color}`,
      color: color,
      textTransform: 'uppercase',
    }}>
      {children}
    </span>
  );
}

export default function ResolutionsPage() {
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'correct' | 'incorrect' | 'uncertain'>('all');

  useEffect(() => {
    fetchResolutions();
  }, []);

  const fetchResolutions = async () => {
    try {
      const response = await fetch('/api/resolutions');
      if (!response.ok) throw new Error('Failed to fetch resolutions');
      const data = await response.json();
      setResolutions(data.resolutions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (filename: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(filename)) {
        next.delete(filename);
      } else {
        next.add(filename);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedIds(new Set(filteredResolutions.map(r => r.filename)));
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  const filteredResolutions = resolutions.filter(r => {
    if (filter === 'all') return true;
    if (filter === 'correct') return r.result?.correct === true;
    if (filter === 'incorrect') return r.result?.correct === false && r.result?.final_answer !== 'UNCERTAIN';
    if (filter === 'uncertain') return r.result?.final_answer === 'UNCERTAIN';
    return true;
  });

  const stats = {
    total: resolutions.length,
    correct: resolutions.filter(r => r.result?.correct).length,
    incorrect: resolutions.filter(r => !r.result?.correct && r.result?.final_answer !== 'UNCERTAIN').length,
    uncertain: resolutions.filter(r => r.result?.final_answer === 'UNCERTAIN').length,
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem' }}>
        <h1 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Resolution History</h1>
        <div className="pulsing" style={{ color: 'var(--text-dim)' }}>Loading resolutions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem' }}>
        <h1 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Resolution History</h1>
        <div style={{ color: 'var(--red)' }}>Error: {error}</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Resolution History</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
          View all market resolution attempts with consensus data and reasoning
        </p>
      </div>

      {/* Stats Bar */}
      <div style={{
        display: 'flex',
        gap: '1.5rem',
        padding: '1rem',
        background: 'var(--bg-dark)',
        border: '1px solid var(--border)',
        marginBottom: '1rem',
        fontSize: '0.85rem',
      }}>
        <div>
          <span style={{ color: 'var(--text-dim)' }}>Total: </span>
          <span style={{ fontWeight: 'bold' }}>{stats.total}</span>
        </div>
        <div>
          <span style={{ color: 'var(--text-dim)' }}>Correct: </span>
          <span style={{ color: 'var(--green)', fontWeight: 'bold' }}>{stats.correct}</span>
        </div>
        <div>
          <span style={{ color: 'var(--text-dim)' }}>Incorrect: </span>
          <span style={{ color: 'var(--red)', fontWeight: 'bold' }}>{stats.incorrect}</span>
        </div>
        <div>
          <span style={{ color: 'var(--text-dim)' }}>Uncertain: </span>
          <span style={{ color: 'var(--yellow)', fontWeight: 'bold' }}>{stats.uncertain}</span>
        </div>
        <div style={{ flex: 1 }} />
        <div>
          <span style={{ color: 'var(--text-dim)' }}>Accuracy: </span>
          <span style={{
            color: stats.total > 0 && stats.correct / (stats.correct + stats.incorrect) > 0.5 ? 'var(--green)' : 'var(--red)',
            fontWeight: 'bold',
          }}>
            {stats.correct + stats.incorrect > 0
              ? `${Math.round((stats.correct / (stats.correct + stats.incorrect)) * 100)}%`
              : 'N/A'
            }
          </span>
        </div>
      </div>

      {/* Controls */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '1rem',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginRight: '0.5rem' }}>FILTER:</span>
        {(['all', 'correct', 'incorrect', 'uncertain'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '0.4rem 0.75rem',
              fontSize: '0.75rem',
              background: filter === f ? 'var(--text)' : 'var(--bg-black)',
              color: filter === f ? 'var(--bg-black)' : 'var(--text-dim)',
              border: `1px solid ${filter === f ? 'var(--text)' : 'var(--border)'}`,
              textTransform: 'uppercase',
            }}
          >
            {f}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        <button onClick={expandAll} style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}>
          Expand All
        </button>
        <button onClick={collapseAll} style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}>
          Collapse All
        </button>
      </div>

      {/* Resolution Cards */}
      {filteredResolutions.length === 0 ? (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          color: 'var(--text-dim)',
          border: '1px solid var(--border)',
        }}>
          {resolutions.length === 0
            ? 'No resolutions found. Run some market resolutions to see them here.'
            : 'No resolutions match the current filter.'
          }
        </div>
      ) : (
        <div>
          {filteredResolutions.map(resolution => (
            <ResolutionCard
              key={resolution.filename}
              resolution={resolution}
              isExpanded={expandedIds.has(resolution.filename)}
              onToggle={() => toggleExpanded(resolution.filename)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
