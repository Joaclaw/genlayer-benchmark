import React from 'react';

interface StatCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    type?: 'default' | 'success' | 'error' | 'warning' | 'neutral';
}

export default function StatCard({ title, value, subtitle, type = 'default' }: StatCardProps) {
    let valueColor = 'var(--text-main)';
    if (type === 'success') valueColor = 'var(--accent-green)';
    if (type === 'error') valueColor = 'var(--accent-red)';
    if (type === 'warning') valueColor = '#d29922';
    if (type === 'neutral') valueColor = '#8b5cf6';

    return (
        <div className="glass-card">
            <div className="stat-title">{title}</div>
            <div className="stat-value" style={{ color: valueColor }}>{value}</div>
            {subtitle && (
                <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                    {subtitle}
                </div>
            )}
        </div>
    );
}
