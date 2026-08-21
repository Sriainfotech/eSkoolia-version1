'use client';
import { useState, useMemo, useCallback } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import type { BotContext, LastViewedEntity } from '@/types/bot';

/**
 * Builds the BotContext object AIBot.tsx passes into resolve()/the
 * manifest loader/confirmation cards. usePermissions() is a hook, so this
 * must be called from a component (AIBot.tsx) — resolvers/providers never
 * call it themselves, they just receive the plain object this returns.
 */
export function useBotContextValue(): BotContext {
  const { can, hasFeature } = usePermissions();
  const [lastViewedEntity, setLastViewedEntityState] = useState<LastViewedEntity | null>(null);

  const setLastViewedEntity = useCallback((entity: LastViewedEntity | null) => {
    setLastViewedEntityState(entity);
  }, []);

  return useMemo<BotContext>(() => ({
    can, hasFeature, lastViewedEntity, setLastViewedEntity,
  }), [can, hasFeature, lastViewedEntity, setLastViewedEntity]);
}
