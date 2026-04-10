import { useCallback, useState } from "react";

/**
 * Custom hook for managing loading state during async operations
 * Prevents duplicate submissions and manages button state
 *
 * @example
 * const { isLoading, execute } = useActionLoader();
 *
 * const handleSave = async () => {
 *   await execute(async () => {
 *     await apiPost("/api/save", data);
 *     setSuccess("Saved successfully");
 *   });
 * };
 */
export function useActionLoader() {
  const [isLoading, setIsLoading] = useState(false);

  const execute = useCallback(
    async (action: () => Promise<void>, onFinally?: () => void) => {
      if (isLoading) return; // Prevent duplicate calls

      setIsLoading(true);
      try {
        await action();
      } finally {
        setIsLoading(false);
        onFinally?.();
      }
    },
    [isLoading]
  );

  return {
    isLoading,
    execute,
    setIsLoading, // For manual control if needed
  };
}

/**
 * Hook for managing multiple action loaders simultaneously
 * Useful for components with multiple buttons
 *
 * @example
 * const loaders = useMultipleActionLoaders(['save', 'delete', 'import']);
 * const { execute: executeSave, isLoading: isSaving } = loaders.save;
 */
export function useMultipleActionLoaders(actionNames: string[]) {
  const loaders = actionNames.reduce(
    (acc, name) => ({
      ...acc,
      [name]: useActionLoader(),
    }),
    {} as Record<string, ReturnType<typeof useActionLoader>>
  );

  return loaders;
}

/**
 * Hook for managing loading state with page-level overlay
 * Useful for heavy operations like import, bulk operations
 *
 * @example
 * const { isLoading, execute, message } = usePageLoader();
 *
 * const handleImport = async () => {
 *   await execute(
 *     async () => {
 *       await apiPost("/api/import", files);
 *     },
 *     "Importing data..."
 *   );
 * };
 */
export function usePageLoader() {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("Loading...");

  const execute = useCallback(async (action: () => Promise<void>, loadingMessage = "Loading...") => {
    setMessage(loadingMessage);
    setIsLoading(true);
    try {
      await action();
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    message,
    execute,
    setIsLoading,
    setMessage,
  };
}
