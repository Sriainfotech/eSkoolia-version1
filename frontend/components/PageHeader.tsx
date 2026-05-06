import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { ReactNode } from 'react';

interface Tab { label: string; href: string; }
interface Props {
  module: { name: string; path: string };
  title: string;
  titleAccent?: string;
  description?: string;
  actions?: ReactNode;
  tabs?: Tab[];
  activeTab?: string;
}

export function PageHeader({ module, title, titleAccent, description, actions, tabs, activeTab }: Props) {
  return (
    <header style={{ background: '#fff', borderBottom: '1px solid var(--bd)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 24px 16px' }}>
        {/* Breadcrumb */}
        <nav style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 11, fontFamily: 'monospace', color: 'var(--ink-3)', marginBottom: 12,
        }}>
          <Link href="/home" style={{ color: 'inherit', textDecoration: 'none' }}
            onMouseEnter={e => ((e.target as HTMLElement).style.color = 'var(--pu)')}
            onMouseLeave={e => ((e.target as HTMLElement).style.color = 'var(--ink-3)')}>
            Home
          </Link>
          <ChevronRight size={11} style={{ opacity: 0.6 }} />
          <Link href={module.path} style={{ color: 'inherit', textDecoration: 'none' }}
            onMouseEnter={e => ((e.target as HTMLElement).style.color = 'var(--pu)')}
            onMouseLeave={e => ((e.target as HTMLElement).style.color = 'var(--ink-3)')}>
            {module.name}
          </Link>
          <ChevronRight size={11} style={{ opacity: 0.6 }} />
          <span style={{ color: 'var(--ink-2)' }}>{title}{titleAccent ? ` ${titleAccent}` : ''}</span>
        </nav>

        {/* Title + Actions row */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{
              fontSize: 28, fontWeight: 600, letterSpacing: '-0.025em',
              color: 'var(--ink-1)', margin: 0, lineHeight: 1.15,
            }}>
              {title}
              {titleAccent && (
                <span style={{ marginLeft: 8, fontStyle: 'italic', fontWeight: 300, color: 'var(--pu)' }}>
                  {titleAccent}
                </span>
              )}
            </h1>
            {description && (
              <p style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 6, marginBottom: 0, lineHeight: 1.5, maxWidth: 640 }}>
                {description}
              </p>
            )}
          </div>
          {actions && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 2 }}>
              {actions}
            </div>
          )}
        </div>

        {/* Tabs */}
        {tabs && tabs.length > 0 && (
          <div style={{ display: 'flex', gap: 4, marginTop: 20, marginBottom: -16 }}>
            {tabs.map(t => (
              <Link
                key={t.href}
                href={t.href}
                style={{
                  position: 'relative', height: 36, padding: '0 14px',
                  display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 500,
                  textDecoration: 'none', transition: 'color 0.15s',
                  color: activeTab === t.label ? 'var(--ink-1)' : 'var(--ink-2)',
                }}
                onMouseEnter={e => {
                  if (activeTab !== t.label)
                    (e.currentTarget as HTMLAnchorElement).style.color = 'var(--ink-1)';
                }}
                onMouseLeave={e => {
                  if (activeTab !== t.label)
                    (e.currentTarget as HTMLAnchorElement).style.color = 'var(--ink-2)';
                }}
              >
                {t.label}
                {activeTab === t.label && (
                  <span style={{
                    position: 'absolute', left: 14, right: 14, bottom: 0,
                    height: 2, background: 'var(--pu)', borderRadius: '2px 2px 0 0',
                  }} />
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
