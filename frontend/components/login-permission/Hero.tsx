import type { Role } from '@/lib/login-permission/types';

interface Props {
  role: Role | '';
}

export function Hero({ role: _role }: Props) {
  return (
    <div className="bg-white border-b border-[var(--bd,#dbe4f0)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-4">
        {/* Breadcrumb */}
        <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--ink-3,#64748b)] uppercase mb-2">
          Roles &amp; Permissions&nbsp;&middot;&nbsp;Login Permission
        </p>

        {/* Heading */}
        <h1 className="text-3xl sm:text-4xl font-bold leading-tight mb-1">
          <span className="text-[var(--ink-1,#0f172a)]">Login </span>
          <span
            className="italic font-normal"
            style={{
              fontFamily: 'var(--font-playfair, Georgia, serif)',
              color: 'var(--pu, #3b5bdb)',
            }}
          >
            Permission
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-xs text-[var(--ink-3,#64748b)] max-w-lg leading-relaxed">
          Control who can log into the system, reset credentials, and onboard
          new users by role.
        </p>
      </div>
    </div>
  );
}
