'use client';
import { useWidgetStore } from '@/lib/widgetStore';
import { FEATURES } from '@/lib/featureFlags';
import { MorningBrief } from './cockpit/MorningBrief';
import { SmartTodoList } from './cockpit/SmartTodoList';
import { WeekAhead } from './cockpit/WeekAhead';
import { NotificationsInbox } from './cockpit/NotificationsInbox';
import { CallsQueue } from './cockpit/CallsQueue';
import { DraftsPending } from './cockpit/DraftsPending';
import { QuickBroadcast } from './cockpit/QuickBroadcast';
import { PinnedNotes } from './cockpit/PinnedNotes';

export function RightRail({ className }: { className?: string }) {
  const { isEnabled } = useWidgetStore();
  return (
    <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }} className={className}>
      {FEATURES.aiMorningBrief && isEnabled('morning-brief') && <MorningBrief />}
      {isEnabled('smart-todo')     && <SmartTodoList />}
      {isEnabled('week-ahead')     && <WeekAhead />}
      {isEnabled('notifications')  && <NotificationsInbox />}
      {isEnabled('calls-queue')    && <CallsQueue />}
      {isEnabled('drafts')         && <DraftsPending />}
      {isEnabled('broadcast')      && <QuickBroadcast />}
      {isEnabled('pinned-notes')   && <PinnedNotes />}
    </aside>
  );
}
