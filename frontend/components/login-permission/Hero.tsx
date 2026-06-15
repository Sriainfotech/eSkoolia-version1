import type { PortalTab } from '@/lib/login-permission/types';

const TAB_META: Record<PortalTab, { title: string; subtitle: string; badge: string; badgeColor: string }> = {
  teacher: {
    title: 'Teaching Staff',
    subtitle: 'Manage login access and credentials for all teachers and class teachers.',
    badge: 'Teacher Portal',
    badgeColor: 'bg-[var(--pu-soft,#EEEAFF)] text-[var(--pu,#6D4AFF)]',
  },
  principal: {
    title: 'Principals & Leadership',
    subtitle: 'Manage login access and credentials for principals, vice principals, and HODs.',
    badge: 'Admin Console',
    badgeColor: 'bg-indigo-50 text-indigo-700',
  },
  student: {
    title: 'Students',
    subtitle: 'Manage login access and portal credentials for enrolled students.',
    badge: 'Student Portal',
    badgeColor: 'bg-sky-50 text-sky-700',
  },
  parent: {
    title: 'Parents & Guardians',
    subtitle: 'Manage login access and credentials for parents and guardians.',
    badge: 'Parent Portal',
    badgeColor: 'bg-rose-50 text-rose-700',
  },
  driver: {
    title: 'Drivers & Transport Staff',
    subtitle: 'Manage login access and credentials for transport and driver staff.',
    badge: 'Transport Role',
    badgeColor: 'bg-orange-50 text-orange-700',
  },
  staff: {
    title: 'Admin & Support Staff',
    subtitle: 'Manage login access and credentials for administrative and support staff.',
    badge: 'Admin Console',
    badgeColor: 'bg-slate-100 text-slate-700',
  },
};

interface Props {
  activeTab: PortalTab;
}

export function Hero({ activeTab }: Props) {
  const meta = TAB_META[activeTab];
  return (
    <div className="bg-white border-b border-[var(--bd,#dbe4f0)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-4">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--ink-3,#64748b)] uppercase mb-2">
          Roles &amp; Permissions&nbsp;&middot;&nbsp;Credential Manager
        </p>

        <div className="flex flex-wrap items-baseline gap-3 mb-1">
          <h1 className="text-3xl sm:text-4xl font-bold leading-tight">
            <span className="text-[var(--ink-1,#0f172a)]">Login </span>
            <em
              style={{
                fontFamily: 'var(--font-instrument-serif,\'Instrument Serif\',Georgia,serif)',
                color: 'var(--pu,#6D4AFF)',
                fontWeight: 400,
                fontSize: '2.4rem',
              }}
            >
              Credentials
            </em>
          </h1>
          <span
            className={`text-[10px] font-bold px-2.5 py-1 rounded-full tracking-wide uppercase ${meta.badgeColor}`}
          >
            {meta.badge}
          </span>
        </div>

        <p className="text-xs text-[var(--ink-3,#64748b)] max-w-lg leading-relaxed">
          {meta.subtitle}
        </p>
      </div>
    </div>
  );
}
