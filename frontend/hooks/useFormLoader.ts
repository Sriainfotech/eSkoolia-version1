"use client";

import { useMemo, useState } from "react";

type ActionType = "save" | "delete" | "update" | "custom";

export function useFormLoader() {
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setErrorState] = useState("");
  const [success, setSuccessState] = useState("");

  const clearMessages = () => {
    setErrorState("");
    setSuccessState("");
  };

  const setError = (message: string) => {
    setSuccessState("");
    setErrorState(message || "");
  };

  const setSuccessMessage = (message: string) => {
    setErrorState("");
    setSuccessState(message || "");
  };

  const execute = async (action: ActionType, work: () => Promise<void>) => {
    clearMessages();

    const isDeleteAction = action === "delete";
    if (isDeleteAction) setIsDeleting(true);
    else setIsSaving(true);

    try {
      await work();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Operation failed";
      setError(message);
      throw err;
    } finally {
      if (isDeleteAction) setIsDeleting(false);
      else setIsSaving(false);
    }
  };

  return useMemo(
    () => ({
      isSaving,
      isDeleting,
      error,
      success,
      clearMessages,
      setError,
      setSuccessMessage,
      execute,
    }),
    [isSaving, isDeleting, error, success],
  );
}
