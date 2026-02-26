import { readFileSync } from 'fs';
import { join } from 'path';

export default function ContractPage() {
  const contractCode = readFileSync(
    join(process.cwd(), 'contracts/polymarket_resolver.py'),
    'utf-8'
  );

  return (
    <>
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Contract Code</h1>
      <p style={{ color: '#8b949e', marginBottom: '2rem' }}>
        PolymarketResolver Intelligent Contract
      </p>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Contract Features</h3>
        <ul style={{ lineHeight: '1.8', color: '#8b949e' }}>
          <li>📡 <strong>Web Access:</strong> Fetches resolution URLs with error handling</li>
          <li>🤖 <strong>LLM Resolution:</strong> Uses AI to determine YES/NO from content</li>
          <li>🔒 <strong>Consensus:</strong> Multiple validators reach agreement</li>
          <li>📊 <strong>Diagnostics:</strong> Tracks HTTP status, paywall detection, failure reasons</li>
          <li>✅ <strong>Validation:</strong> Compares GenLayer result with Polymarket outcome</li>
        </ul>
      </div>

      <div className="card">
        <pre style={{
          maxHeight: '600px',
          overflow: 'auto',
          margin: 0
        }}>
          <code>{contractCode}</code>
        </pre>
      </div>
    </>
  );
}
