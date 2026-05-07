'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MODULES } from '@/lib/routes';

/** Finds the module that "owns" the given pathname */
function findOwnerModule(pathname: string) {
  let match = MODULES.find(m => m.path === pathname);
  if (match) return match;
  match = MODULES.find(m => m.sub.some(s => s.path === pathname));
  if (match) return match;
  const byLength = [...MODULES]
    .filter(m => pathname.startsWith(m.path) && m.path !== '/')
    .sort((a, b) => b.path.length - a.path.length);
  return byLength[0] ?? null;
}

export function ModuleSubNav() {
  const pathname = usePathname();
  const mod = findOwnerModule(pathname);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', checkScroll); ro.disconnect(); };
  }, [checkScroll, mod]);

  // Scroll active tab into view on route change
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const active = el.querySelector('[data-active="true"]') as HTMLElement | null;
    if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [pathname]);

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' });
  };

  if (!mod || mod.sub.length === 0) return null;

  // Find the best-matching active tab (longest path match wins, preventing parent paths from being
  // active on child routes, e.g. /roles being active on /roles/login-permission)
  const activeTab = mod.sub.reduce<typeof mod.sub[0] | null>((best, s) => {
    const isExact = pathname === s.path;
    const isPrefix = pathname.startsWith(s.path + '/');
    if (!isExact && !isPrefix) return best;
    if (!best) return s;
    return s.path.length > best.path.length ? s : best;
  }, null);

  const arrowBtn = (dir: 'left' | 'right', enabled: boolean) => (
    <button
      onClick={() => scroll(dir)}
      disabled={!enabled}
      style={{
        flexShrink: 0, width: 28, height: 42, border: 'none', cursor: enabled ? 'pointer' : 'default',
        background: enabled
          ? 'linear-gradient(to ' + (dir === 'left' ? 'right' : 'left') + ', #fff 60%, transparent)'
          : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: enabled ? 1 : 0.25, transition: 'opacity 0.15s',
        position: 'relative', zIndex: 2,
        padding: 0,
      }}
    >
      {dir === 'left'
        ? <ChevronLeft size={15} color="var(--ink-2)" strokeWidth={2} />
        : <ChevronRight size={15} color="var(--ink-2)" strokeWidth={2} />
      }
    </button>
  );

  return (
    <div style={{ background: '#fff', borderBottom: '1px solid var(--bd)', position: 'relative' }}>
      <div style={{
        maxWidth: 1280, margin: '0 auto',
        display: 'flex', alignItems: 'center', height: 42,
        padding: '0 24px 0 8px', gap: 0,
      }}>
        {/* Module label — left side breadcrumb */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          paddingRight: 14, marginRight: 8,
          borderRight: '1px solid var(--bd)',
          flexShrink: 0,
        }}>
          <div style={{
            width: 20, height: 20, borderRadius: 6,
            background: mod.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <mod.icon size={11} color={mod.ic} strokeWidth={1.8} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
            {mod.name}
          </span>
        </div>

        {/* Left arrow */}
        {arrowBtn('left', canScrollLeft)}

        {/* Scrollable tabs — left-aligned */}
        <div
          ref={scrollRef}
          style={{ display: 'flex', overflowX: 'auto', scrollbarWidth: 'none', gap: 0, flex: 1 }}
        >
          {mod.sub.map(s => {
            const isActive = s === activeTab;
            const SubIcon = s.icon ?? mod.icon;
            return (
              <Link
                key={s.path}
                href={s.path}
                data-active={isActive ? 'true' : 'false'}
                style={{
                  position: 'relative',
                  display: 'flex', alignItems: 'center', gap: 5,
                  height: 42, padding: '0 12px',
                  fontSize: 12.5, fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--pu)' : 'var(--ink-2)',
                  textDecoration: 'none', whiteSpace: 'nowrap',
                  transition: 'color 0.12s',
                  borderBottom: isActive ? '2px solid var(--pu)' : '2px solid transparent',
                  flexShrink: 0,
                }}
                onMouseEnter={e => {
                  if (!isActive) (e.currentTarget as HTMLAnchorElement).style.color = 'var(--ink-1)';
                }}
                onMouseLeave={e => {
                  if (!isActive) (e.currentTarget as HTMLAnchorElement).style.color = 'var(--ink-2)';
                }}
              >
                <SubIcon size={12} strokeWidth={1.8} />
                {s.label}
              </Link>
            );
          })}
        </div>

        {/* Right arrow */}
        {arrowBtn('right', canScrollRight)}
      </div>
    </div>
  );
}
