import type { FAQProvider } from '@/types/bot';

/**
 * Stub for a future retrieval-augmented FAQ provider. Not wired up —
 * queries here routinely carry health/absence reasons and fee status,
 * and that needs an explicit data-leaves-the-system decision before any
 * third-party model call is made. Implements FAQProvider so switching
 * lib/featureFlags.ts's BOT_FAQ_PROVIDER_TYPE to 'rag' is the only change
 * needed later — nothing in AIBot.tsx changes.
 */
export class RAGFAQProvider implements FAQProvider {
  providerType = 'rag';

  classify(_query: string): string | null {
    throw new Error('RAGFAQProvider is not yet configured — see lib/featureFlags.ts BOT_FAQ_PROVIDER_TYPE.');
  }

  async lookup(_topicKey: string): Promise<string | null> {
    throw new Error('RAGFAQProvider is not yet configured — see lib/featureFlags.ts BOT_FAQ_PROVIDER_TYPE.');
  }
}
