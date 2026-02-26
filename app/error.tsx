'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ 
      textAlign: 'center', 
      padding: '4rem 2rem',
      maxWidth: '600px',
      margin: '0 auto'
    }}>
      <h2 style={{ 
        fontSize: '2rem', 
        marginBottom: '1rem',
        color: '#f85149'
      }}>
        Something went wrong
      </h2>
      <p style={{ 
        color: '#8b949e',
        marginBottom: '2rem',
        lineHeight: '1.6'
      }}>
        {error.message || 'An error occurred while loading this page'}
      </p>
      <button
        onClick={reset}
        style={{
          padding: '12px 24px',
          background: '#238636',
          border: 'none',
          borderRadius: '6px',
          color: '#fff',
          fontSize: '1rem',
          cursor: 'pointer',
          fontWeight: '600'
        }}
      >
        Try again
      </button>
    </div>
  );
}
