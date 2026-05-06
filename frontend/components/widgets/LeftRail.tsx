'use client';
import { useWidgetStore } from '@/lib/widgetStore';
import { AttendanceSnapshot } from './pulse/AttendanceSnapshot';
import { SickBay } from './pulse/SickBay';
import { BusFleet } from './pulse/BusFleet';
import { FeesToday } from './pulse/FeesToday';
import { StaffLeave } from './pulse/StaffLeave';

function RailHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: 4, paddingBottom: 12, borderBottom: '1px solid var(--bd)' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)', letterSpacing: '-0.01em' }}>{title}</div>
      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{subtitle}</div>
    </div>
  );
}

export function LeftRail({ className }: { className?: string }) {
  const { isEnabled } = useWidgetStore();
  return (
    <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }} className={className}>
      <RailHeader title="Today's Pulse" subtitle="Live operational status" />
      {isEnabled('attendance') && <AttendanceSnapshot />}
      {isEnabled('sickbay')    && <SickBay />}
      {isEnabled('busfleet')   && <BusFleet />}
      {isEnabled('feestoday')  && <FeesToday />}
      {isEnabled('staffleave') && <StaffLeave />}
    </aside>
  );
}
