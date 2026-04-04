'use client';

import { useEffect, useState } from 'react';

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    console.error('[Global Error Boundary]', error);
  }, [error]);

  const handleRetry = () => {
    setRetrying(true);
    window.location.reload();
  };

  return (
    <html lang="zh-CN">
      <body style={{ margin: 0, background: '#050508', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
        }}>
          <div style={{ maxWidth: '320px', textAlign: 'center' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(245,158,11,0.1)',
              border: '1px solid rgba(245,158,11,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
              fontSize: '28px',
            }}>
              ⚠️
            </div>
            <h2 style={{
              fontSize: '1.125rem',
              fontWeight: 900,
              fontStyle: 'italic',
              letterSpacing: '-0.025em',
              marginBottom: '0.5rem',
            }}>
              应用加载失败
            </h2>
            <p style={{
              fontSize: '0.875rem',
              color: '#94a3b8',
              marginBottom: '2rem',
              lineHeight: 1.6,
            }}>
              可能是网络波动或版本更新导致，点击下方按钮即可恢复。
            </p>
            <button
              onClick={handleRetry}
              disabled={retrying}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '1rem 2rem',
                borderRadius: '1rem',
                background: '#6366f1',
                color: '#fff',
                fontSize: '0.75rem',
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                border: 'none',
                cursor: 'pointer',
                opacity: retrying ? 0.5 : 1,
                boxShadow: '0 10px 20px rgba(99,102,241,0.3)',
              }}
            >
              {retrying ? '恢复中...' : '重新加载'}
            </button>
            {error.digest && (
              <p style={{ marginTop: '1.5rem', fontSize: '10px', color: '#475569', fontFamily: 'monospace' }}>
                ref: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
