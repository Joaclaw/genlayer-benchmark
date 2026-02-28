import './globals.css';
import Link from 'next/link';
import { CONTRACT_ADDRESS, CHAIN_NAME } from '@/lib/constants';

export const metadata = {
  title: 'GenLayer Benchmark',
  description: 'Polymarket resolution via GenLayer Intelligent Contracts',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <nav style={{
          background: '#161b22',
          borderBottom: '1px solid #30363d',
          padding: '1rem 0',
          marginBottom: '2rem'
        }}>
          <div className="container" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <Link href="/" style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: '#58a6ff',
              textDecoration: 'none'
            }}>
              🔬 GenLayer Benchmark
            </Link>
            <div style={{
              display: 'flex',
              gap: '2rem',
              alignItems: 'center'
            }}>
              <Link href="/markets">Markets</Link>
              <Link href="/contract">Contract</Link>
              <Link href="/results">Results</Link>
              <Link href="/analysis">Analysis</Link>
            </div>
          </div>
        </nav>
        <main className="container" style={{ paddingBottom: '4rem' }}>
          {children}
        </main>
        <footer style={{
          textAlign: 'center',
          padding: '2rem 0',
          color: '#8b949e',
          fontSize: '0.9rem',
          borderTop: '1px solid #30363d',
          marginTop: '4rem'
        }}>
          <div className="container">
            <div>Contract: <code>{CONTRACT_ADDRESS}</code></div>
            <div style={{ marginTop: '0.5rem' }}>{CHAIN_NAME}</div>
          </div>
        </footer>
      </body>
    </html>
  );
}
