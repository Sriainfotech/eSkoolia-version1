/**
 * Eskoolia feature flags — set to false to disable a feature school-wide.
 * Each flag controls whether the feature's component tree is mounted.
 * Removing the component folder entirely is also safe — the home page won't crash.
 */
export const FEATURES = {
  /** Left sidebar rail: attendance, sick bay, bus fleet, fees, staff leave */
  leftPulseRail: true,
  /** Right sidebar rail: AI brief, todos, notifications, calls, drafts, academic strip, broadcast */
  rightCockpitRail: true,
  /** Page-scoped sticky notes (top-bar trigger + floating panel) */
  stickyNotes: true,
  /** Advanced AI bot: student lookup, profile popup */
  aiBotAdvanced: true,
  /** AI morning/midday/EOD brief card in right rail */
  aiMorningBrief: true,
} as const;

export type FeatureKey = keyof typeof FEATURES;
