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

const FAILURE_LABELS: Record<string, string> = {
    '': 'Resolved',
    'web_forbidden': '403 Forbidden',
    'web_not_found': '404 Not Found',
    'web_timeout': 'Timeout',
    'web_server_error': 'Server Error',
    'web_connection_error': 'Connection Error',
    'web_unknown_error': 'Unknown Error',
    'content_empty': 'Empty Content',
    'content_insufficient': 'Insufficient Data',
    'content_anti_bot': 'Anti-Bot Block',
    'llm_unresolvable': 'LLM Unresolvable',
    'llm_no_answer': 'No Answer'
};

const FAILURE_COLORS: Record<string, { bg: string; text: string }> = {
    '': { bg: 'rgba(34, 197, 94, 0.1)', text: '#22c55e' },
    'web_forbidden': { bg: 'rgba(239, 68, 68, 0.1)', text: '#ef4444' },
    'web_not_found': { bg: 'rgba(239, 68, 68, 0.1)', text: '#ef4444' },
    'web_timeout': { bg: 'rgba(249, 115, 22, 0.1)', text: '#f97316' },
    'web_server_error': { bg: 'rgba(239, 68, 68, 0.1)', text: '#ef4444' },
    'web_connection_error': { bg: 'rgba(249, 115, 22, 0.1)', text: '#f97316' },
    'web_unknown_error': { bg: 'rgba(156, 163, 175, 0.1)', text: '#9ca3af' },
    'content_empty': { bg: 'rgba(251, 191, 36, 0.1)', text: '#fbbf24' },
    'content_insufficient': { bg: 'rgba(251, 191, 36, 0.1)', text: '#fbbf24' },
    'content_anti_bot': { bg: 'rgba(249, 115, 22, 0.1)', text: '#f97316' },
    'llm_unresolvable': { bg: 'rgba(139, 92, 246, 0.1)', text: '#8b5cf6' },
    'llm_no_answer': { bg: 'rgba(139, 92, 246, 0.1)', text: '#8b5cf6' }
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

    // Categorize results
    const categorized = useMemo(() => {
        const resolved = results.filter(r => !r.failure_reason || r.failure_reason === '');
        const webAccess = results.filter(r => r.failure_reason?.startsWith('web_'));
        const content = results.filter(r => r.failure_reason?.startsWith('content_'));
        const llmUnresolvable = results.filter(r => r.failure_reason?.startsWith('llm_'));

        return { resolved, webAccess, content, llmUnresolvable };
    }, [results]);

    // Get subcategory counts for current tab
    const getSubcategoryCounts = (items: MarketData[]) => {
        const counts: Record<string, number> = {};
        items.forEach(item => {
            const reason = item.failure_reason || '';
            counts[reason] = (counts[reason] || 0) + 1;
        });
        return Object.entries(counts).sort((a, b) => b[1] - a[1]);
    };

    const getActiveData = () => {
        let data: MarketData[];
        switch (activeTab) {
            case 'resolved': data = categorized.resolved; break;
            case 'web_access': data = categorized.webAccess; break;
            case 'content': data = categorized.content; break;
            case 'llm_unresolvable': data = categorized.llmUnresolvable; break;
            default: data = [];
        }
        if (subFilter) {
            data = data.filter(r => r.failure_reason === subFilter);
        }
        return data;
    };

    const toggleRow = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    const activeData = getActiveData();
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
                    onClick={() => { setActiveTab('resolved'); setExpandedId(null); setSubFilter(null); }}
                    className={`tab-button ${activeTab === 'resolved' ? 'tab-active-success' : 'tab-inactive-success'}`}
                >
                    Resolved ({categorized.resolved.length})
                </button>
                <button
                    onClick={() => { setActiveTab('web_access'); setExpandedId(null); setSubFilter(null); }}
                    className={`tab-button ${activeTab === 'web_access' ? 'tab-active-error' : 'tab-inactive-error'}`}
                >
                    Web Access Issues ({categorized.webAccess.length})
                </button>
                <button
                    onClick={() => { setActiveTab('content'); setExpandedId(null); setSubFilter(null); }}
                    className={`tab-button ${activeTab === 'content' ? 'tab-active-warning' : 'tab-inactive-warning'}`}
                >
                    Content Issues ({categorized.content.length})
                </button>
                <button
                    onClick={() => { setActiveTab('llm_unresolvable'); setExpandedId(null); setSubFilter(null); }}
                    style={{
                        padding: '1rem 1.5rem',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: 500,
                        color: activeTab === 'llm_unresolvable' ? '#8b5cf6' : 'var(--text-dim)',
                        borderBottom: activeTab === 'llm_unresolvable' ? '2px solid #8b5cf6' : '2px solid transparent',
                        transition: 'all 0.2s ease'
                    }}
                >
                    LLM Unresolvable ({categorized.llmUnresolvable.length})
                </button>
            </div>

            {/* Subcategory Filter Pills */}
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
                    onClick={() => setSubFilter(null)}
                    style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '999px',
                        border: '1px solid var(--border-color)',
                        background: !subFilter ? 'var(--text-main)' : 'transparent',
                        color: !subFilter ? 'var(--bg-main)' : 'var(--text-dim)',
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
                            onClick={() => setSubFilter('__correct__')}
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
                            onClick={() => setSubFilter('__incorrect__')}
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
                                onClick={() => setSubFilter(reason)}
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
            </div>

            {/* Table Content */}
            <div className="data-table-container" style={{ maxHeight: '600px', overflowY: 'auto' }}>
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
                        {(activeTab === 'resolved' && subFilter === '__correct__'
                            ? categorized.resolved.filter(r => r.correct)
                            : activeTab === 'resolved' && subFilter === '__incorrect__'
                            ? categorized.resolved.filter(r => !r.correct)
                            : activeData
                        ).map((market, index) => {
                            // Use index + tab + failure_reason for unique key (market_ids have duplicates)
                            const rId = `${activeTab}-${index}-${market.failure_reason || 'resolved'}`;
                            const isExpanded = expandedId === rId;
                            const hasReasoning = !!market.reasoning || !!market.failure_reason;
                            const failureReason = market.failure_reason || '';
                            const colors = FAILURE_COLORS[failureReason] || { bg: 'rgba(156,163,175,0.1)', text: '#9ca3af' };

                            return (
                                <React.Fragment key={rId}>
                                    <tr
                                        onClick={() => hasReasoning && toggleRow(rId)}
                                        style={{
                                            cursor: hasReasoning ? 'pointer' : 'default',
                                            background: isExpanded ? 'rgba(255,255,255,0.02)' : 'transparent',
                                            transition: 'background 0.2s ease'
                                        }}
                                    >
                                        <td style={{ paddingLeft: '2.5rem', fontWeight: 400, color: 'var(--text-main)' }}>
                                            {market.question || market.market_id}
                                        </td>
                                        <td><span className="badge neutral">{market.expected || 'N/A'}</span></td>
                                        <td>
                                            <span
                                                className={`badge ${market.resolvable && market.correct ? 'success' : market.resolvable && !market.correct ? 'error' : ''}`}
                                                style={!market.resolvable ? { color: colors.text, background: colors.bg } : undefined}
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
                                                    : (FAILURE_LABELS[failureReason] || failureReason.toUpperCase())}
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
                                                    <span style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▼</span>
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

                {activeData.length === 0 && (
                    <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                        No markets matched this category.
                    </div>
                )}
            </div>

        </div>
    );
}
