'use client';
import Link from 'next/link';
import { Clock, ArrowLeft } from 'lucide-react';

export default function ComingSoon() {
  return (
    <div
      style={{
        minHeight: '70vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
      }}
    >
      <div
        style={{
          background: 'var(--bg-1)',
          border: '1px solid var(--bd)',
          borderRadius: 20,
          boxShadow: '0 4px 24px -6px rgba(15,18,34,0.08)',
          padding: '48px 56px',
          maxWidth: 440,
          width: '100%',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0,
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            background: 'var(--pu-soft, #EDE9FE)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
          }}
        >
          <Clock size={28} strokeWidth={1.5} style={{ color: 'var(--pu, #6D28D9)' }} />
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--ink-1)',
            letterSpacing: '-0.02em',
            margin: '0 0 8px',
          }}
        >
          Coming Soon
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: 14,
            color: 'var(--ink-3)',
            lineHeight: 1.6,
            margin: '0 0 32px',
          }}
        >
          This module is under development
        </p>

        {/* Back button */}
        <Link
          href="/home"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            height: 38,
            padding: '0 20px',
            borderRadius: 10,
            background: 'var(--pu, #6D28D9)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            textDecoration: 'none',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.opacity = '0.88')}
          onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.opacity = '1')}
        >
          <ArrowLeft size={14} strokeWidth={2} />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
