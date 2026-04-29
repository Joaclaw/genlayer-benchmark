'use client';
import React, { useState, useMemo } from 'react';

interface CategoryMarket {
    id: string;
    question: string;
    category: string;
    category_reason: string;
    current_status: string;
    resolvable: boolean;
    polymarket_result: string;
    genlayer_result: string;
    correct: boolean;
    failure_reason: string;
}

interface CategoryStats {
    total: number;
    resolvable: number;
    correct: number;
    accuracy: number;
    failed: number;
    failure_rate: number;
}

interface CategoryData {
    total_markets: number;
    categories: Record<string, number>;
    category_stats: Record<string, CategoryStats>;
    markets: CategoryMarket[];
}

type CategoryTab = 'non_deterministic' | 'deterministic' | 'historical_snapshot' | 'needs_review';

const CATEGORY_CONFIG: Record<CategoryTab, { label: string; color: string; colorBg: string; description: string }> = {
    non_deterministic: {
        label: 'Non-Deterministic',
        color: '#60a5fa',
        colorBg: 'rgba(96, 165, 250, 0.1)',
        description: 'Markets requiring judgment, analysis, or multiple sources'
    },
    deterministic: {
        label: 'Deterministic',
        color: '#34d399',
        colorBg: 'rgba(52, 211, 153, 0.1)',
        description: 'Markets with single authoritative data sources'
    },
    historical_snapshot: {
        label: 'Historical Snapshot',
        color: '#fbbf24',
        colorBg: 'rgba(251, 191, 36, 0.1)',
        description: 'Past state or time-bound data points'
    },
    needs_review: {
        label: 'Needs Review',
        color: '#9ca3af',
        colorBg: 'rgba(156, 163, 175, 0.1)',
        description: 'Unclear classification, requires manual review'
    }
};

const PAGE_SIZE = 25;

export default function CategoryView({ data }: { data: CategoryData }) {
    const [activeTab, setActiveTab] = useState<CategoryTab>('non_deterministic');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(0);

    const tabMarkets = useMemo(() => {
        let markets = data.markets.filter(m => m.category === activeTab);
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            markets = markets.filter(m =>
                m.question?.toLowerCase().includes(q) ||
                m.id?.toLowerCase().includes(q)
            );
        }
        return markets;
    }, [data.markets, activeTab, searchQuery]);

    const totalPages = Math.ceil(tabMarkets.length / PAGE_SIZE);
    const pagedMarkets = tabMarkets.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    const switchTab = (tab: CategoryTab) => {
        setActiveTab(tab);
        setExpandedId(null);
        setSearchQuery('');
        setPage(0);
    };

    const config = CATEGORY_CONFIG[activeTab];
    const stats = data.category_stats[activeTab];

    // Insights
    const allCategories = Object.entries(data.category_stats) as [CategoryTab, CategoryStats][];
    const bestAccuracy = allCategories.reduce((best, [cat, s]) =>
        s.resolvable > 0 && s.accuracy > (best.accuracy || 0) ? { cat, accuracy: s.accuracy } : best,
        { cat: '' as CategoryTab, accuracy: 0 }
    );
    const nonDetResolvable = data.category_stats.non_deterministic?.resolvable || 0;
    const nonDetTotal = data.category_stats.non_deterministic?.total || 1;

    // Failure distribution per category
    const failureDistribution = allCategories.map(([cat, s]) => ({
        cat,
        label: CATEGORY_CONFIG[cat].label,
        failures: s.failed,
        pct: data.total_markets > 0 ? Math.round((s.failed / data.total_markets) * 1000) / 10 : 0
    }));

    return (
        <div>
            {/* Insights Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div className="glass-card" style={{ padding: '1.25rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                        Highest Accuracy Category
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 300, color: CATEGORY_CONFIG[bestAccuracy.cat]?.color || 'var(--text-main)' }}>
                        {CATEGORY_CONFIG[bestAccuracy.cat]?.label || 'N/A'}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
                        {bestAccuracy.accuracy}% accuracy on resolved markets
                    </div>
                </div>
                <div className="glass-card" style={{ padding: '1.25rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                        Non-Deterministic Resolvable
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 300, color: '#60a5fa' }}>
                        {nonDetResolvable} / {nonDetTotal}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
                        {Math.round(nonDetResolvable / nonDetTotal * 1000) / 10}% resolved — multi-URL can improve this
                    </div>
                </div>
                <div className="glass-card" style={{ padding: '1.25rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                        Failure Distribution
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.25rem' }}>
                        {failureDistribution.map(fd => (
                            <div key={fd.cat} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                <span style={{ color: CATEGORY_CONFIG[fd.cat as CategoryTab]?.color }}>{fd.label}</span>
                                <span style={{ color: 'var(--text-dim)' }}>{fd.failures} ({fd.pct}%)</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tabbed Category Browser */}
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Category Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card)', flexWrap: 'wrap' }}>
                    {(Object.keys(CATEGORY_CONFIG) as CategoryTab[]).map(cat => {
                        const catConfig = CATEGORY_CONFIG[cat];
                        const count = data.categories[cat] || 0;
                        const pct = Math.round(count / data.total_markets * 1000) / 10;
                        const isActive = activeTab === cat;
                        return (
                            <button
                                key={cat}
                                onClick={() => switchTab(cat)}
                                className="tab-button"
                                style={{
                                    color: isActive ? catConfig.color : 'var(--text-dim)',
                                    fontWeight: isActive ? 500 : 400,
                                    borderBottom: isActive ? `2px solid ${catConfig.color}` : '2px solid transparent',
                                    position: 'relative'
                                }}
                            >
                                {catConfig.label} ({count} / {pct}%)
                            </button>
                        );
                    })}
                </div>

                {/* Category Detail Bar */}
                <div style={{
                    padding: '1rem 1.5rem',
                    borderBottom: '1px solid var(--border-color)',
                    background: 'rgba(0,0,0,0.2)',
                    display: 'flex',
                    gap: '2rem',
                    flexWrap: 'wrap',
                    alignItems: 'center'
                }}>
                    <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {config.description}
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: '1.5rem', marginLeft: 'auto', flexWrap: 'wrap' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.25rem', fontWeight: 300, color: config.color }}>{stats.total}</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Total</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.25rem', fontWeight: 300, color: '#34d399' }}>{stats.resolvable}</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Resolved</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.25rem', fontWeight: 300, color: '#22c55e' }}>{stats.correct}</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Correct</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.25rem', fontWeight: 300, color: stats.accuracy >= 90 ? '#22c55e' : stats.accuracy >= 70 ? '#fbbf24' : '#ef4444' }}>{stats.accuracy}%</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Accuracy</div>
                        </div>
                    </div>
                    <div style={{ position: 'relative', minWidth: '200px' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }}>
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Search markets..."
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
                        />
                    </div>
                </div>

                {/* Market Table */}
                <div className="data-table-container" style={{ maxHeight: '500px', overflowY: 'auto', border: 'none', borderRadius: 0 }}>
                    <table className="data-table" style={{ margin: 0 }}>
                        <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 10 }}>
                            <tr>
                                <th style={{ paddingLeft: '2.5rem', width: '40%' }}>Market Question</th>
                                <th style={{ width: '12%' }}>Expected</th>
                                <th style={{ width: '12%' }}>GenLayer</th>
                                <th style={{ width: '18%' }}>Status</th>
                                <th style={{ width: '18%', paddingRight: '2.5rem', textAlign: 'right' }}>Classification</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pagedMarkets.map((market, index) => {
                                const rId = `cat-${activeTab}-${page}-${index}`;
                                const isExpanded = expandedId === rId;

                                const statusColor = market.resolvable
                                    ? (market.correct ? '#22c55e' : '#ef4444')
                                    : '#9ca3af';
                                const statusBg = market.resolvable
                                    ? (market.correct ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)')
                                    : 'rgba(156, 163, 175, 0.1)';
                                const statusLabel = market.resolvable
                                    ? (market.correct ? 'CORRECT' : 'INCORRECT')
                                    : (market.failure_reason || 'UNRESOLVED').replace(/_/g, ' ').toUpperCase();

                                return (
                                    <React.Fragment key={rId}>
                                        <tr
                                            onClick={() => setExpandedId(isExpanded ? null : rId)}
                                            style={{
                                                cursor: 'pointer',
                                                background: isExpanded ? 'rgba(255,255,255,0.02)' : 'transparent',
                                                transition: 'background 0.2s ease'
                                            }}
                                        >
                                            <td style={{ paddingLeft: '2.5rem', fontWeight: 400, color: 'var(--text-main)' }}>
                                                <div className="truncate" title={market.question}>
                                                    {market.question}
                                                </div>
                                            </td>
                                            <td><span className="badge neutral">{market.polymarket_result || 'N/A'}</span></td>
                                            <td>
                                                <span
                                                    className={`badge ${market.resolvable && market.correct ? 'success' : market.resolvable && !market.correct ? 'error' : ''}`}
                                                    style={!market.resolvable ? { color: statusColor, background: statusBg, border: `1px solid ${statusColor}22` } : undefined}
                                                >
                                                    {market.genlayer_result || 'UNRESOLVED'}
                                                </span>
                                            </td>
                                            <td>
                                                <span style={{
                                                    display: 'inline-block',
                                                    padding: '0.2rem 0.6rem',
                                                    borderRadius: '4px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 500,
                                                    background: statusBg,
                                                    color: statusColor
                                                }}>
                                                    {statusLabel}
                                                </span>
                                            </td>
                                            <td style={{ paddingRight: '2.5rem', textAlign: 'right' }}>
                                                <span style={{
                                                    fontSize: '0.8rem',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem',
                                                    color: isExpanded ? 'var(--text-main)' : 'var(--text-dim)',
                                                    transition: 'color 0.2s'
                                                }}>
                                                    {isExpanded ? 'Hide' : 'Expand'}
                                                    <span style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>&#9660;</span>
                                                </span>
                                            </td>
                                        </tr>

                                        {isExpanded && (
                                            <tr>
                                                <td colSpan={5} className="reasoning-cell" style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                    <div style={{ maxWidth: '900px', color: 'var(--text-dim)', fontSize: '0.95rem', lineHeight: 1.7 }}>
                                                        <div style={{ fontWeight: 500, color: 'var(--text-main)', marginBottom: '0.75rem', letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.8rem' }}>
                                                            Classification Detail
                                                        </div>
                                                        <div style={{ marginBottom: '0.75rem' }}>
                                                            <span style={{ color: config.color, fontWeight: 500 }}>Category:</span>{' '}
                                                            {config.label}
                                                        </div>
                                                        <div style={{ marginBottom: '0.75rem' }}>
                                                            <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>Reason:</span>{' '}
                                                            {market.category_reason}
                                                        </div>
                                                        <div>
                                                            <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>Market ID:</span>{' '}
                                                            <code style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>{market.id}</code>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>

                    {pagedMarkets.length === 0 && (
                        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                            {searchQuery ? `No markets matching "${searchQuery}"` : 'No markets in this category.'}
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="pagination">
                        <button disabled={page === 0} onClick={() => { setPage(0); setExpandedId(null); }}>
                            First
                        </button>
                        <button disabled={page === 0} onClick={() => { setPage(p => p - 1); setExpandedId(null); }}>
                            Prev
                        </button>
                        <span>
                            Page {page + 1} of {totalPages} ({tabMarkets.length} results)
                        </span>
                        <button disabled={page >= totalPages - 1} onClick={() => { setPage(p => p + 1); setExpandedId(null); }}>
                            Next
                        </button>
                        <button disabled={page >= totalPages - 1} onClick={() => { setPage(totalPages - 1); setExpandedId(null); }}>
                            Last
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
