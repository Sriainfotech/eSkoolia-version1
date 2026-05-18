'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronRight, Menu, X, LayoutDashboard, Building2, CreditCard, FileText, Settings, LogOut } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';
import { clearAuthTokens, getAccessToken, getRefreshToken } from '@/lib/auth';

interface SuperAdminSidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: (collapsed: boolean) => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

/**
 * Super Admin Sidebar
 * 
 * Collapsible sidebar with navigation matching the PDF design.
 * Features:
 * - Active route indicator
 * - Smooth collapse animation
 * - Profile section with logout
 * - Icon + label layout
 * - Mobile responsive
 */
export default function SuperAdminSidebar({ collapsed = false, onToggleCollapse }: SuperAdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(collapsed);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  React.useEffect(() => {
    setIsCollapsed(collapsed);
  }, [collapsed]);

  const handleToggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    onToggleCollapse?.(next);
  };

  const navItems: NavItem[] = [
    {
      label: 'Dashboard',
      href: '/super-admin/dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      label: 'Schools',
      href: '/super-admin/schools',
      icon: <Building2 className="w-5 h-5" />,
    },
    {
      label: 'Billing',
      href: '/super-admin/billing',
      icon: <CreditCard className="w-5 h-5" />,
    },
    {
      label: 'Audit',
      href: '/super-admin/audit',
      icon: <FileText className="w-5 h-5" />,
    },
    {
      label: 'Policies',
      href: '/super-admin/policies',
      icon: <Settings className="w-5 h-5" />,
    },
  ];

  const isActive = (href: string) => pathname?.startsWith(href);

  const handleLogout = async () => {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);
    const access = getAccessToken();
    const refresh = getRefreshToken();

    try {
      if (refresh) {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (access) {
          headers.Authorization = `Bearer ${access}`;
        }
        await fetch(`${API_BASE_URL}/api/v1/auth/logout/`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ refresh }),
        });
      }
    } finally {
      clearAuthTokens();
      router.replace('/login');
      setLoggingOut(false);
    }
  };

  return (
    <>
      {/* Mobile Menu Toggle */}
      <div className="fixed left-0 right-0 top-0 z-50 flex h-16 items-center border-b border-[var(--bd)] bg-[var(--bg-1)] px-4 md:hidden sa-topbar">
        <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="p-2 rounded-lg hover:bg-[var(--bg-2)] transition">
          {showMobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
        <h1 className="ml-4 text-xl font-bold tracking-tight text-[var(--ink-1)]">Eskoolia Console</h1>
      </div>

      {/* Mobile Menu Overlay */}
      {showMobileMenu && (
        <div
          className="fixed inset-0 z-30 bg-black/45 md:hidden"
          onClick={() => setShowMobileMenu(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`sa-sidebar fixed left-0 top-16 z-40 flex h-[calc(100vh-64px)] flex-col border-r border-[var(--bd)] bg-[var(--bg-1)] transition-all duration-300 md:relative md:top-0 md:h-screen ${
          isCollapsed ? 'w-20' : 'w-64'
        } ${showMobileMenu ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        {/* Logo / Branding */}
        <div className="flex h-16 items-center justify-between border-b border-[var(--bd)] px-4">
          {!isCollapsed && <h1 className="text-xl font-bold tracking-tight text-[var(--ink-1)]">Eskoolia</h1>}
          <button
            onClick={handleToggleCollapse}
            className="hidden rounded-lg p-2 transition-colors hover:bg-[var(--bg-2)] md:flex"
            title="Toggle sidebar"
          >
            <ChevronRight className={`w-5 h-5 transition-transform ${isCollapsed ? '' : 'rotate-180'}`} />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-2 py-4">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setShowMobileMenu(false)}
                className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2 transition-all font-medium ${
                  active
                    ? 'bg-[var(--pu)] text-white shadow-sm'
                    : 'text-[var(--ink-2)] hover:bg-[var(--bg-2)]'
                }`}
                style={active ? {fontWeight: 700} : {}}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!isCollapsed && (
                  <span className="flex-1 text-[15px] truncate">{item.label}</span>
                )}
                {item.badge && !isCollapsed && (
                  <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Profile & Logout Section */}
        <div className="border-t border-[var(--bd)] p-4">
          <button
            onClick={handleLogout}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[var(--ink-2)] transition-all hover:bg-[var(--bg-2)] ${
              isCollapsed ? 'justify-center' : ''
            }`}
            title="Logout"
            disabled={loggingOut}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!isCollapsed && <span className="text-[15px] font-medium">{loggingOut ? 'Logging out...' : 'Logout'}</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
