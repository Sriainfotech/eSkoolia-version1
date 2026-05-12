'use client';
import { useState } from 'react';
import { Greeting } from '@/components/home/Greeting';
import { QuickAccessGrid } from '@/components/home/QuickAccessGrid';
import { RecentsRow } from '@/components/home/RecentsRow';
import { ModuleGrid } from '@/components/home/ModuleGrid';
import { SectionLabel } from '@/components/home/SectionLabel';
import { ManagePinsModal } from '@/components/home/ManagePinsModal';
import { useUserPrefs } from '@/lib/userPrefs';
import { useWidgetStore } from '@/lib/widgetStore';
import { LeftRail } from '@/components/widgets/LeftRail';
import { RightRail } from '@/components/widgets/RightRail';
import { MODULES, FLAT_INDEX } from '@/lib/routes';

function HomeCenter() {
  const { prefs, addPin, removePin } = useUserPrefs();
  const [managePinsOpen, setManagePinsOpen] = useState(false);
  // Filter out pinned items whose module has been hidden from routes
  const visiblePins = prefs.pins.filter(pin => FLAT_INDEX.some(f => f.path === pin.path));

  return (
    <div style={{ minWidth: 0 }}>
      <Greeting />

      {prefs.showQuickAccess !== false && (
        <>
          <SectionLabel
            title="Quick Access"
            pinned={visiblePins.length}
            action="Manage"
            onAction={() => setManagePinsOpen(true)}
          />
          {visiblePins.length > 0
            ? <QuickAccessGrid pins={visiblePins} onRemove={removePin} />
            : (
              <div style={{
                textAlign: 'center', padding: '20px 0',
                fontSize: 12.5, color: 'var(--ink-3)',
                border: '1.5px dashed var(--bd)', borderRadius: 12,
              }}>
                No pinned pages yet — click <strong>Manage →</strong> to add some
              </div>
            )
          }
        </>
      )}

      {prefs.showRecents !== false && <RecentsRow />}
      <SectionLabel title="All Modules" count={MODULES.length} />
      <ModuleGrid />

      {managePinsOpen && (
        <ManagePinsModal
          pins={prefs.pins}
          onAdd={addPin}
          onRemove={removePin}
          onClose={() => setManagePinsOpen(false)}
        />
      )}
    </div>
  );
}

export default function HomePage() {
  const { isEnabled } = useWidgetStore();
  const showLeft  = isEnabled('attendance') || isEnabled('sickbay') || isEnabled('busfleet') || isEnabled('feestoday') || isEnabled('staffleave');
  const showRight = isEnabled('morning-brief') || isEnabled('smart-todo') || isEnabled('week-ahead') || isEnabled('notifications') || isEnabled('calls-queue') || isEnabled('drafts') || isEnabled('broadcast') || isEnabled('pinned-notes');

  return (
    <div
      data-left={showLeft ? 'on' : 'off'}
      data-right={showRight ? 'on' : 'off'}
      style={{
        display: 'grid',
        gap: 28,
        maxWidth: 1680,
        margin: '0 auto',
        padding: '24px 28px 56px',
        gridTemplateColumns: '1fr',
      }}
      className="home-grid"
    >
      {/*
        Always render both rail divs so the center column never reflowss.
        Empty rails collapse to 0px via CSS custom properties on the grid.
      */}
      <div className="home-left-rail" style={{ minWidth: 0, overflow: 'hidden' }}>
        {showLeft && <LeftRail />}
      </div>
      <HomeCenter />
      <div className="home-right-rail" style={{ minWidth: 0, overflow: 'hidden' }}>
        {showRight && <RightRail />}
      </div>

      <style>{`
        /* Mobile: single column, rails hidden */
        .home-left-rail  { display: none; }
        .home-right-rail { display: none; }

        /* ≥1024px: show left rail; right rail collapsed (0px) */
        @media (min-width: 1024px) {
          .home-grid {
            grid-template-columns: 272px 1fr 0px !important;
            gap: 32px !important;
          }
          .home-left-rail  { display: block !important; }
          .home-right-rail { display: block !important; }

          /* Left rail off → collapse it, center stays locked */
          .home-grid[data-left="off"] {
            grid-template-columns: 0px 1fr 0px !important;
          }
        }

        /* ≥1360px: both rails active — center is always locked at 1fr */
        @media (min-width: 1360px) {
          .home-grid {
            grid-template-columns: 280px 1fr 340px !important;
            gap: 32px !important;
          }
          /* Each rail collapses independently — center 1fr never changes */
          .home-grid[data-left="off"]  { grid-template-columns: 0px 1fr 340px !important; }
          .home-grid[data-right="off"] { grid-template-columns: 280px 1fr 0px !important; }
          .home-grid[data-left="off"][data-right="off"] {
            grid-template-columns: 0px 1fr 0px !important;
          }
        }

        @media (min-width: 1560px) {
          .home-grid {
            grid-template-columns: 296px 1fr 360px !important;
            gap: 36px !important;
          }
          .home-grid[data-left="off"]  { grid-template-columns: 0px 1fr 360px !important; }
          .home-grid[data-right="off"] { grid-template-columns: 296px 1fr 0px !important; }
          .home-grid[data-left="off"][data-right="off"] {
            grid-template-columns: 0px 1fr 0px !important;
          }
        }
      `}</style>
    </div>
  );
}
