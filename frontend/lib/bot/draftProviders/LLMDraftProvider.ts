import type { MessageDraftProvider } from '@/types/bot';

/**
 * Stub for a future LLM-backed draft generator. Not wired up — see the
 * note in lib/bot/faqProviders/RAGFAQProvider.ts; same data-leaves-the-
 * system decision applies here. Implements MessageDraftProvider so
 * switching lib/featureFlags.ts's BOT_DRAFT_PROVIDER_TYPE to 'llm' is the
 * only change needed later.
 */
export class LLMDraftProvider implements MessageDraftProvider {
  providerType = 'llm';

  async draft(_topicKey: string, _params?: Record<string, string>): Promise<string> {
    throw new Error('LLMDraftProvider is not yet configured — see lib/featureFlags.ts BOT_DRAFT_PROVIDER_TYPE.');
  }
}
