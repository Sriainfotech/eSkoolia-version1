import type React from "react";

/**
 * Utility for creating loading-aware button styles
 *
 * @example
 * const btnStyle = getActionButtonStyle(isLoading, "Save", "Saving...");
 */
export function getActionButtonStyle(
  actionName: string,
  isLoading: boolean,
  baseStyle: Record<string, any>
) {
  return {
    ...baseStyle,
    opacity: isLoading ? 0.7 : 1,
    cursor: isLoading ? "not-allowed" : "pointer",
    pointerEvents: isLoading ? "none" : "auto",
  } as const;
}

/**
 * Create button content object for use in ActionButton
 * The component will render this content
 */
export function createButtonContent(
  isLoading: boolean,
  label: string,
  loadingLabel?: string
): { isLoading: boolean; label: string; loadingLabel?: string } {
  return {
    isLoading,
    label,
    loadingLabel,
  };
}

/**
 * Wrapper for async action handlers with automatic loading state management
 *
 * @example
 * const handleSave = createActionHandler(
 *   async () => {
 *     await apiPost("/api/save", data);
 *   },
 *   setIsLoading,
 *   setError,
 *   setSuccess
 * );
 */
export function createActionHandler(
  action: () => Promise<void>,
  setIsLoading: (loading: boolean) => void,
  setError?: (error: string) => void,
  setSuccess?: (message: string) => void
) {
  return async () => {
    if (setError) setError("");
    if (setSuccess) setSuccess("");

    setIsLoading(true);
    try {
      await action();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again";
      if (setError) setError(message);
      console.error("Action failed:", err);
    } finally {
      setIsLoading(false);
    }
  };
}

/**
 * Helper for API calls with automatic error/success handling
 *
 * @example
 * const { execute, isLoading } = useApiAction(
 *   async () => await apiPost("/api/save", data),
 *   setError,
 *   setSuccess
 * );
 */
export async function executeApiAction(
  apiCall: () => Promise<{ success?: boolean; message?: string }>,
  onSuccess: (message: string) => void,
  onError: (message: string) => void
) {
  try {
    const response = await apiCall();
    if (response.success === false) {
      onError(response.message || "Operation failed");
      return false;
    }
    onSuccess(response.message || "Operation successful");
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error. Please check your connection";
    onError(message);
    return false;
  }
}

/**
 * Validate API response and return formatted error/success
 *
 * @example
 * const result = validateApiResponse(response);
 * if (!result.success) {
 *   setError(result.message);
 *   return;
 * }
 */
export function validateApiResponse(response: any) {
  if (response.success === false) {
    return {
      success: false,
      message: response.message || "Operation failed",
      errors: response.field_errors || {},
    };
  }

  return {
    success: true,
    message: response.message || "Operation successful",
    errors: {},
  };
}

/**
 * Debounce action handler to prevent rapid repeated calls
 *
 * @example
 * const debouncedSave = debounceAction(() => handleSave(), 500);
 */
export function debounceAction(action: () => Promise<void>, delay: number = 300) {
  let timeoutId: NodeJS.Timeout | null = null;

  return async () => {
    if (timeoutId) clearTimeout(timeoutId);

    timeoutId = setTimeout(async () => {
      try {
        await action();
      } finally {
        timeoutId = null;
      }
    }, delay);
  };
}
