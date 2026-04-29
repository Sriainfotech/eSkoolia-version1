type StudentInfoPlaceholderPanelProps = {
  title: string;
};

/**
 * Modern ERP page shell:
 *   h-full flex-col  → fills the viewport-locked <main> area
 *   header shrink-0  → fixed page header (title + breadcrumb)
 *   content flex-1 overflow-y-auto → the only scrollable region
 *
 * No legacy classes (legacy-panel / container-fluid / white-box /
 * admin-visitor-area / mb-20) — those created min-height / margin conflicts
 * that fought the dashboard shell's scroll model.
 */
export function StudentInfoPlaceholderPanel({ title }: StudentInfoPlaceholderPanelProps) {
  return (
    <div className="h-full flex flex-col">
      <header className="shrink-0 flex items-center justify-between gap-4 bg-white border-b border-slate-200 px-6 py-4">
        <h1 className="m-0 text-xl font-semibold text-slate-900">{title}</h1>
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 text-[13px] text-slate-500"
        >
          <span>Dashboard</span>
          <span aria-hidden="true">/</span>
          <span>Student Info</span>
          <span aria-hidden="true">/</span>
          <span className="text-slate-900 font-medium">{title}</span>
        </nav>
      </header>

      <section className="flex-1 overflow-y-auto bg-slate-50 p-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="m-0 mb-2 text-base font-semibold text-slate-900">{title}</h3>
          <p className="m-0 text-sm leading-relaxed text-slate-600">
            This Student Info screen is now routed correctly. Legacy parity UI for this page can be implemented next.
          </p>
        </div>
      </section>
    </div>
  );
}
