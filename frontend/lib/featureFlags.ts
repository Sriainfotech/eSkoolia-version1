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

/**
 * Which IntentResolver implementation "Ask eSkoolia" uses. Switching this
 * to 'llm' is meant to be the ONLY change required to swap resolvers —
 * AIBot.tsx and the manifests never change. LLMIntentResolver is stubbed
 * (lib/bot/resolvers/LLMIntentResolver.ts) and throws until a real
 * data-leaves-the-system decision is made; do not flip this yet.
 */
export const BOT_RESOLVER_TYPE: 'manifest-fuzzy' | 'llm' = 'manifest-fuzzy';

/** Same swap-later pattern for draft-message generation. */
export const BOT_DRAFT_PROVIDER_TYPE: 'template' | 'llm' = 'template';

/** Same swap-later pattern for parent FAQ lookup. */
export const BOT_FAQ_PROVIDER_TYPE: 'backend-table' | 'rag' = 'backend-table';
