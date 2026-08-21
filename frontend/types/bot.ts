/**
 * Core "Ask eSkoolia" bot types. Every place that resolves "what did the
 * user mean" or "what should this draft message say" sits behind one of
 * the interfaces below — never called directly from a component. The
 * concrete implementation today is manifest + fuzzy-match / templates;
 * swapping in an LLM-backed implementation later means adding a new class
 * that implements the same interface and flipping `resolverType` in
 * lib/featureFlags.ts, with zero changes to AIBot.tsx or the manifests.
 */

/** One parameter a BotAction accepts. Shaped so a manifest can double as
 *  an LLM function-calling tool schema later (id/description/parameters),
 *  even though nothing consumes it that way yet. */
export interface ParamSpec {
  type: 'string' | 'number' | 'boolean' | 'date';
  description: string;
  required?: boolean;
  enum?: string[];
}

export interface BotActionResult {
  success: boolean;
  /** Natural-language result the bot shows the user. */
  message: string;
  data?: unknown;
}

export interface BotAction {
  id: string;
  label: string;
  /** Dotted permission code, checked against usePermissions().can() before
   *  this action is ever offered — see access_control naming convention
   *  (e.g. "student_info.student_attendance.view"). */
  requiredPermissionCode: string;
  requiresConfirmation: boolean;
  /** Tool-schema-shaped description for an eventual LLM function-calling
   *  resolver. Also shown to the user on the confirmation card. */
  description: string;
  parameters: Record<string, ParamSpec>;
  execute: (params: Record<string, unknown>, context: BotContext) => Promise<BotActionResult>;
}

export interface BotEntityConfig {
  /** REST endpoint this manifest searches/reads, e.g. "/api/v1/students/students/". */
  endpoint: string;
  /** Query params (besides `search`) used to look up an entity by id. */
  searchFields: string[];
  /** Fields pulled from each raw API row to build a human-readable result. */
  displayFields: string[];
}

export interface BotModuleManifest {
  id: string;
  label: string;
  entity: BotEntityConfig;
  /** Substrings/synonyms that route a query to this manifest. */
  keywords: string[];
  actions: BotAction[];
  /** Tenant ABAC gate — checked against usePermissions().hasFeature(). */
  requiredFeatureFlag?: string;
}

export interface BotEntityResult {
  id: string | number;
  displayLabel: string;
  subtitle?: string;
  raw: Record<string, unknown>;
}

/** A query that matched exactly one manifest/action/entity. */
export interface ResolvedIntent {
  kind: 'resolved';
  manifest: BotModuleManifest;
  /** Set when the query matched an action (e.g. "mark absent") rather than a lookup. */
  action?: BotAction;
  params?: Record<string, unknown>;
  /** Set when the query matched a lookup/search (e.g. student search results). */
  entityResults?: BotEntityResult[];
}

export interface DisambiguationOption {
  label: string;
  description?: string;
  /** Re-run resolution with this option selected. */
  resolve: () => Promise<ResolvedIntent | null>;
}

/** Returned instead of ResolvedIntent when more than one close match exists —
 *  AIBot.tsx renders a clarifying choice instead of dumping a raw list. */
export interface DisambiguationResult {
  kind: 'disambiguation';
  prompt: string;
  options: DisambiguationOption[];
}

export interface LastViewedEntity {
  type: string;
  id: string | number;
  label: string;
}

/** Session context passed into every resolve() call. can()/hasFeature() are
 *  hook outputs from usePermissions() — read inside AIBot.tsx (a component)
 *  and threaded down here. Resolvers must never import/call the hook
 *  directly, since resolve() runs outside React render. */
export interface BotContext {
  can: (permissionCode: string) => boolean;
  hasFeature: (featureFlag: string) => boolean;
  lastViewedEntity: LastViewedEntity | null;
  setLastViewedEntity: (entity: LastViewedEntity | null) => void;
}

export interface IntentResolver {
  /** Recorded on every telemetry log row so a future LLM resolver's
   *  recognition rate can be compared directly against this one's. */
  resolverType: string;
  resolve(query: string, context: BotContext): Promise<ResolvedIntent | DisambiguationResult | null>;
}

/** Draft-message generation — same swap-later pattern as IntentResolver. */
export interface MessageDraftProvider {
  providerType: string;
  draft(topicKey: string, params?: Record<string, string>): Promise<string>;
}

/** Parent-facing FAQ lookup — same swap-later pattern. A future
 *  RAGFAQProvider implements this same interface. */
export interface FAQProvider {
  providerType: string;
  /** Classify a raw query into one of this provider's known topic keys,
   *  or null if nothing matches closely enough. */
  classify(query: string): string | null;
  lookup(topicKey: string): Promise<string | null>;
  /** Optional — warms whatever cache classify()/lookup() read from before
   *  the first query arrives (e.g. on bot-open). */
  preload?(): Promise<void>;
}
