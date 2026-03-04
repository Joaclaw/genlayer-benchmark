'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';

// Custom Minimalist SVG Icons
const BarChartIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"></line>
    <line x1="12" y1="20" x2="12" y2="4"></line>
    <line x1="6" y1="20" x2="6" y2="14"></line>
  </svg>
);

const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

export default function Navigation() {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'PolyMarket Data', icon: <BarChartIcon /> },
    { href: '/analysis', label: 'Analysis & Results', icon: <SearchIcon /> },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <span className="logo-gradient">
            GenLayer
          </span>
          Benchmark
        </div>
      </div>

      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {links.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-link ${isActive ? 'active' : ''}`}
            >
              <span style={{ display: 'flex', alignItems: 'center', opacity: isActive ? 1 : 0.6, transition: 'opacity 0.2s' }}>
                {link.icon}
              </span>
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div style={{ marginTop: 'auto', padding: '1.5rem 1rem', borderTop: '1px solid var(--border-color)', color: 'var(--text-dim)', fontSize: '0.8rem', lineHeight: 1.5 }}>
        <div style={{ fontWeight: 500, color: 'var(--text-main)', marginBottom: '0.25rem' }}>System Overview</div>
        Intelligent Contract validation suite for empirical accuracy benchmarking.
      </div>
    </aside>
  );
}
