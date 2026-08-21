import type { FAQProvider, IntentResolver, MessageDraftProvider } from '@/types/bot';
import { BOT_DRAFT_PROVIDER_TYPE, BOT_FAQ_PROVIDER_TYPE, BOT_RESOLVER_TYPE } from '@/lib/featureFlags';
import { ManifestFuzzyResolver } from './resolvers/ManifestFuzzyResolver';
import { LLMIntentResolver } from './resolvers/LLMIntentResolver';
import { TemplateDraftProvider } from './draftProviders/TemplateDraftProvider';
import { LLMDraftProvider } from './draftProviders/LLMDraftProvider';
import { BackendFAQProvider } from './faqProviders/BackendFAQProvider';
import { RAGFAQProvider } from './faqProviders/RAGFAQProvider';

/**
 * The only place that reads the resolverType/providerType flags and picks
 * a concrete class. AIBot.tsx calls these factory functions and never
 * imports a resolver/provider class directly — flipping a flag in
 * lib/featureFlags.ts is the entire swap.
 */
export function createIntentResolver(): IntentResolver {
  switch (BOT_RESOLVER_TYPE) {
    case 'llm': return new LLMIntentResolver();
    case 'manifest-fuzzy':
    default: return new ManifestFuzzyResolver();
  }
}

export function createMessageDraftProvider(): MessageDraftProvider {
  switch (BOT_DRAFT_PROVIDER_TYPE) {
    case 'llm': return new LLMDraftProvider();
    case 'template':
    default: return new TemplateDraftProvider();
  }
}

export function createFAQProvider(): FAQProvider {
  switch (BOT_FAQ_PROVIDER_TYPE) {
    case 'rag': return new RAGFAQProvider();
    case 'backend-table':
    default: return new BackendFAQProvider();
  }
}
