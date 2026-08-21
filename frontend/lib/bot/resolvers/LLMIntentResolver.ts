import type { BotContext, DisambiguationResult, IntentResolver, ResolvedIntent } from '@/types/bot';

/**
 * Stub for a future LLM-backed resolver. Not wired up — bot queries
 * routinely carry student names, health/absence reasons, and fee status,
 * and that needs an explicit data-leaves-the-system decision before any
 * third-party model call is made (see the roadmap discussion this was
 * scoped out of). Implements IntentResolver so switching
 * lib/featureFlags.ts's BOT_RESOLVER_TYPE to 'llm' is the only change
 * required later — nothing in AIBot.tsx or the manifests changes.
 */
export class LLMIntentResolver implements IntentResolver {
  resolverType = 'llm';

  async resolve(_query: string, _context: BotContext): Promise<ResolvedIntent | DisambiguationResult | null> {
    throw new Error('LLMIntentResolver is not yet configured — see lib/featureFlags.ts BOT_RESOLVER_TYPE.');
  }
}
