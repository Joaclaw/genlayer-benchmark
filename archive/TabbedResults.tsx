'use client';
import React, { useState, useMemo } from 'react';

interface MarketData {
    market_id: string;
    question: string;
    expected: string;
    genlayer: string;
    correct: boolean;
    resolvable: boolean;
    reasoning: string;
    failure_reason?: string;
}

type TabCategory = 'resolved' | 'web_access' | 'content' | 'llm_unresolvable';

const PAGE_SIZE = 50;

const FAILURE_LABELS: Record<string, string> = {
    '': 'Resolved',
    'web_forbidden': '403 Forbidden',
    'web_not_found': '404 Not Found',
    'web_timeout': 'Timeout',
    'web_server_error': 'Server Error',
    'web_connection_error': 'Connection Error',
    'web_unknown_error': 'Unknown Error',
    'web_rate_limited': 'Rate Limited',
    'web_ssl_error': 'SSL Error',
    'web_dns_error': 'DNS Error',
    'content_empty': 'Empty Content',
    'content_insufficient': 'Insufficient Data',
    'content_anti_bot': 'Anti-Bot Block',
    'content_paywall': 'Paywall',
    'llm_unresolvable': 'LLM Unresolvable',
    'llm_no_answer': 'No Answer',
    'llm_error': 'LLM Error',
    'llm_invalid_response': 'Invalid Response'
};

const FAILURE_COLORS: Record<string, { bg: string; text: string }> = {
    '': { bg: 'rgba(34, 197, 94, 0.1)', text: '#22c55e' },
    'web_forbidden': { bg: 'rgba(239, 68, 68, 0.1)', text: '#ef4444' },
    'web_not_found': { bg: 'rgba(239, 68, 68, 0.1)', text: '#ef4444' },
    'web_timeout': { bg: 'rgba(249, 115, 22, 0.1)', text: '#f97316' },
    'web_server_error': { bg: 'rgba(239, 68, 68, 0.1)', text: '#ef4444' },
    'web_connection_error': { bg: 'rgba(249, 115, 22, 0.1)', text: '#f97316' },
    'web_unknown_error': { bg: 'rgba(156, 163, 175, 0.1)', text: '#9ca3af' },
    'web_rate_limited': { bg: 'rgba(249, 115, 22, 0.1)', text: '#f97316' },
    'web_ssl_error': { bg: 'rgba(239, 68, 68, 0.1)', text: '#ef4444' },
    'web_dns_error': { bg: 'rgba(239, 68, 68, 0.1)', text: '#ef4444' },
    'content_empty': { bg: 'rgba(251, 191, 36, 0.1)', text: '#fbbf24' },
    'content_insufficient': { bg: 'rgba(251, 191, 36, 0.1)', text: '#fbbf24' },
    'content_anti_bot': { bg: 'rgba(249, 115, 22, 0.1)', text: '#f97316' },
    'content_paywall': { bg: 'rgba(251, 191, 36, 0.1)', text: '#fbbf24' },
    'llm_unresolvable': { bg: 'rgba(139, 92, 246, 0.1)', text: '#8b5cf6' },
    'llm_no_answer': { bg: 'rgba(139, 92, 246, 0.1)', text: '#8b5cf6' },
    'llm_error': { bg: 'rgba(139, 92, 246, 0.1)', text: '#8b5cf6' },
    'llm_invalid_response': { bg: 'rgba(139, 92, 246, 0.1)', text: '#8b5cf6' }
};

function getCategory(failure_reason: string | undefined): TabCategory {
    if (!failure_reason || failure_reason === '') return 'resolved';
    if (failure_reason.startsWith('web_')) return 'web_access';
    if (failure_reason.startsWith('content_')) return 'content';
    return 'llm_unresolvable';
}

export default function TabbedResults({ results }: { results: MarketData[] }) {
    const [activeTab, setActiveTab] = useState<TabCategory>('resolved');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [subFilter, setSubFilter] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(0);

    const categorized = useMemo(() => {
        const resolved = results.filter(r => !r.failure_reason || r.failure_reason === '');
        const webAccess = results.filter(r => r.failure_reason?.startsWith('web_'));
        const content = results.filter(r => r.failure_reason?.startsWith('content_'));
        const llmUnresolvable = results.filter(r => r.failure_reason?.startsWith('llm_'));
        return { resolved, webAccess, content, llmUnresolvable };
    }, [results]);

    const getSubcategoryCounts = (items: MarketData[]) => {
        const counts: Record<string, number> = {};
        items.forEach(item => {
            const reason = item.failure_reason || '';
            counts[reason] = (counts[reason] || 0) + 1;
        });
        return Object.entries(counts).sort((a, b) => b[1] - a[1]);
    };

    const filteredData = useMemo(() => {
        let data: MarketData[];
        switch (activeTab) {
            case 'resolved': data = categorized.resolved; break;
            case 'web_access': data = categorized.webAccess; break;
            case 'content': data = categorized.content; break;
            case 'llm_unresolvable': data = categorized.llmUnresolvable; break;
            default: data = [];
        }

        if (activeTab === 'resolved' && subFilter === '__correct__') {
            data = data.filter(r => r.correct);
        } else if (activeTab === 'resolved' && subFilter === '__incorrect__') {
            data = data.filter(r => !r.correct);
        } else if (subFilter) {
            data = data.filter(r => r.failure_reason === subFilter);
        }

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            data = data.filter(r =>
                r.question?.toLowerCase().includes(q) ||
                r.market_id?.toLowerCase().includes(q)
            );
        }

        return data;
    }, [activeTab, subFilter, searchQuery, categorized]);

    const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);
    const pagedData = filteredData.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    const switchTab = (tab: TabCategory) => {
        setActiveTab(tab);
        setExpandedId(null);
        setSubFilter(null);
        setSearchQuery('');
        setPage(0);
    };

    const currentTabData = activeTab === 'resolved' ? categorized.resolved :
        activeTab === 'web_access' ? categorized.webAccess :
            activeTab === 'content' ? categorized.content : categorized.llmUnresolvable;
    const subcategories = getSubcategoryCounts(currentTabData);

    const resolvedCorrect = categorized.resolved.filter(r => r.correct).length;
    const resolvedIncorrect = categorized.resolved.filter(r => !r.correct).length;

    return (
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>

            {/* Main Category Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card)', flexWrap: 'wrap' }}>
                <button
                    onClick={() => switchTab('resolved')}
                    className={`tab-button ${activeTab === 'resolved' ? 'tab-active-success' : 'tab-inactive-success'}`}
                >
                    Resolved ({categorized.resolved.length})
                </button>
                <button
                    onClick={() => switchTab('web_access')}
                    className={`tab-button ${activeTab === 'web_access' ? 'tab-active-error' : 'tab-inactive-error'}`}
                >
                    Web Access ({categorized.webAccess.length})
                </button>
                <button
                    onClick={() => switchTab('content')}
                    className={`tab-button ${activeTab === 'content' ? 'tab-active-warning' : 'tab-inactive-warning'}`}
                >
                    Content ({categorized.content.length})
                </button>
                <button
                    onClick={() => switchTab('llm_unresolvable')}
                    className={`tab-button ${activeTab === 'llm_unresolvable' ? 'tab-active-warning' : 'tab-inactive-warning'}`}
                    style={activeTab === 'llm_unresolvable' ? { color: '#8b5cf6' } : undefined}
                >
                    LLM Unresolvable ({categorized.llmUnresolvable.length})
                </button>
            </div>

            {/* Subcategory Filter Pills + Search */}
            <div style={{
                padding: '0.75rem 1.5rem',
                borderBottom: '1px solid var(--border-color)',
                background: 'rgba(0,0,0,0.2)',
                display: 'flex',
                gap: '0.5rem',
                flexWrap: 'wrap',
                alignItems: 'center'
            }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginRight: '0.5rem' }}>Filter:</span>
                <button
                    onClick={() => { setSubFilter(null); setPage(0); }}
                    style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '999px',
                        border: '1px solid var(--border-color)',
                        background: !subFilter ? 'var(--text-main)' : 'transparent',
                        color: !subFilter ? '#050505' : 'var(--text-dim)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    All ({currentTabData.length})
                </button>
                {activeTab === 'resolved' ? (
                    <>
                        <button
                            onClick={() => { setSubFilter('__correct__'); setPage(0); }}
                            style={{
                                padding: '0.25rem 0.75rem',
                                borderRadius: '999px',
                                border: '1px solid var(--border-color)',
                                background: subFilter === '__correct__' ? '#22c55e' : 'transparent',
                                color: subFilter === '__correct__' ? '#000' : '#22c55e',
                                fontSize: '0.75rem',
                                cursor: 'pointer'
                            }}
                        >
                            Correct ({resolvedCorrect})
                        </button>
                        <button
                            onClick={() => { setSubFilter('__incorrect__'); setPage(0); }}
                            style={{
                                padding: '0.25rem 0.75rem',
                                borderRadius: '999px',
                                border: '1px solid var(--border-color)',
                                background: subFilter === '__incorrect__' ? '#ef4444' : 'transparent',
                                color: subFilter === '__incorrect__' ? '#fff' : '#ef4444',
                                fontSize: '0.75rem',
                                cursor: 'pointer'
                            }}
                        >
                            Incorrect ({resolvedIncorrect})
                        </button>
                    </>
                ) : (
                    subcategories.map(([reason, count]) => {
                        const colors = FAILURE_COLORS[reason] || { bg: 'rgba(156,163,175,0.1)', text: '#9ca3af' };
                        return (
                            <button
                                key={reason}
                                onClick={() => { setSubFilter(reason); setPage(0); }}
                                style={{
                                    padding: '0.25rem 0.75rem',
                                    borderRadius: '999px',
                                    border: '1px solid var(--border-color)',
                                    background: subFilter === reason ? colors.text : 'transparent',
                                    color: subFilter === reason ? '#000' : colors.text,
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {FAILURE_LABELS[reason] || reason} ({count})
                            </button>
                        );
                    })
                )}

                <div style={{ marginLeft: 'auto', position: 'relative', minWidth: '200px' }}>
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

            {/* Table Content */}
            <div className="data-table-container" style={{ maxHeight: '600px', overflowY: 'auto', border: 'none', borderRadius: 0 }}>
                <table className="data-table" style={{ margin: 0 }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 10 }}>
                        <tr>
                            <th style={{ paddingLeft: '2.5rem', width: '45%' }}>Market Question</th>
                            <th style={{ width: '10%' }}>Expected</th>
                            <th style={{ width: '10%' }}>GenLayer</th>
                            <th style={{ width: '20%' }}>Status</th>
                            <th style={{ width: '15%', paddingRight: '2.5rem', textAlign: 'right' }}>Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pagedData.map((market, index) => {
                            const rId = `${activeTab}-${page}-${index}-${market.failure_reason || 'resolved'}`;
                            const isExpanded = expandedId === rId;
                            const hasReasoning = !!market.reasoning || !!market.failure_reason;
                            const failureReason = market.failure_reason || '';
                            const colors = FAILURE_COLORS[failureReason] || { bg: 'rgba(156,163,175,0.1)', text: '#9ca3af' };

                            return (
                                <React.Fragment key={rId}>
                                    <tr
                                        onClick={() => hasReasoning && setExpandedId(isExpanded ? null : rId)}
                                        style={{
                                            cursor: hasReasoning ? 'pointer' : 'default',
                                            background: isExpanded ? 'rgba(255,255,255,0.02)' : 'transparent',
                                            transition: 'background 0.2s ease'
                                        }}
                                    >
                                        <td style={{ paddingLeft: '2.5rem', fontWeight: 400, color: 'var(--text-main)' }}>
                                            <div className="truncate" title={market.question || market.market_id}>
                                                {market.question || market.market_id}
                                            </div>
                                        </td>
                                        <td><span className="badge neutral">{market.expected || 'N/A'}</span></td>
                                        <td>
                                            <span
                                                className={`badge ${market.resolvable && market.correct ? 'success' : market.resolvable && !market.correct ? 'error' : ''}`}
                                                style={!market.resolvable ? { color: colors.text, background: colors.bg, border: `1px solid ${colors.text}22` } : undefined}
                                            >
                                                {market.genlayer || 'UNRESOLVED'}
                                            </span>
                                        </td>
                                        <td>
                                            <span style={{
                                                display: 'inline-block',
                                                padding: '0.2rem 0.6rem',
                                                borderRadius: '4px',
                                                fontSize: '0.75rem',
                                                fontWeight: 500,
                                                background: market.resolvable
                                                    ? (market.correct ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)')
                                                    : colors.bg,
                                                color: market.resolvable
                                                    ? (market.correct ? '#22c55e' : '#ef4444')
                                                    : colors.text
                                            }}>
                                                {market.resolvable
                                                    ? (market.correct ? 'CORRECT' : 'INCORRECT')
                                                    : (FAILURE_LABELS[failureReason] || failureReason.replace(/_/g, ' ').toUpperCase())}
                                            </span>
                                        </td>
                                        <td style={{ paddingRight: '2.5rem', textAlign: 'right', color: 'var(--text-dim)' }}>
                                            {hasReasoning && (
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
                                            )}
                                        </td>
                                    </tr>

                                    {isExpanded && hasReasoning && (
                                        <tr>
                                            <td colSpan={5} className="reasoning-cell" style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                <div style={{ maxWidth: '900px', color: 'var(--text-dim)', fontSize: '0.95rem', lineHeight: 1.7 }}>
                                                    <div style={{ fontWeight: 500, color: 'var(--text-main)', marginBottom: '0.75rem', letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.8rem' }}>
                                                        GenLayer Reasoning Output
                                                    </div>
                                                    {market.reasoning || `Failure Category: ${FAILURE_LABELS[failureReason] || failureReason.replace(/_/g, ' ').toUpperCase()}`}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>

                {pagedData.length === 0 && (
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
                        Page {page + 1} of {totalPages} ({filteredData.length} results)
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
    );
}
