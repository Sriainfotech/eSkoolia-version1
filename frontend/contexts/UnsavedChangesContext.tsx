"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

interface UnsavedChangesApi {
  registerGuard: (isDirty: boolean, onSave: () => Promise<void>) => void;
}

const UnsavedChangesContext = createContext<UnsavedChangesApi | null>(null);

/**
 * Registers the current page's dirty state + save action with the nearest
 * UnsavedChangesProvider. When the user tries to navigate away (clicking another
 * settings tab, the browser back button, or closing/refreshing the tab) while
 * `isDirty` is true, a Save / Discard / Cancel prompt intercepts the navigation.
 */
export function useUnsavedChangesGuard(isDirty: boolean, onSave: () => Promise<void>) {
  const ctx = useContext(UnsavedChangesContext);
  useEffect(() => {
    ctx?.registerGuard(isDirty, onSave);
  });
  useEffect(() => {
    return () => ctx?.registerGuard(false, async () => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

type PendingNav = { kind: "link"; href: string } | { kind: "back" };

export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const dirtyRef = useRef(false);
  const saveRef = useRef<() => Promise<void>>(async () => {});
  const skipNextPopRef = useRef(false);

  const [pending, setPending] = useState<PendingNav | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const registerGuard = useCallback((isDirty: boolean, onSave: () => Promise<void>) => {
    dirtyRef.current = isDirty;
    saveRef.current = onSave;
  }, []);

  // Intercept clicks on internal links (top nav, settings sub-nav, etc.)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!dirtyRef.current) return;
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      let url: URL;
      try {
        url = new URL(anchor.href, window.location.origin);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      const href = url.pathname + url.search + url.hash;
      if (href === pathname) return;
      e.preventDefault();
      e.stopPropagation();
      setSaveError(null);
      setPending({ kind: "link", href });
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [pathname]);

  // Warn on browser refresh / tab close
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // Intercept browser back/forward
  useEffect(() => {
    const handler = () => {
      if (skipNextPopRef.current) {
        skipNextPopRef.current = false;
        return;
      }
      if (!dirtyRef.current) return;
      // Cancel the navigation the browser just performed by pushing the current
      // path back on top, then ask the user what to do.
      window.history.pushState(null, "", pathname);
      setSaveError(null);
      setPending({ kind: "back" });
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [pathname]);

  const proceed = useCallback((nav: PendingNav) => {
    dirtyRef.current = false;
    if (nav.kind === "link") {
      router.push(nav.href);
    } else {
      skipNextPopRef.current = true;
      window.history.back();
    }
  }, [router]);

  const handleCancel = () => setPending(null);

  const handleDiscard = () => {
    const nav = pending;
    setPending(null);
    if (nav) proceed(nav);
  };

  const handleSaveAndContinue = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await saveRef.current();
      const nav = pending;
      setPending(null);
      if (nav) proceed(nav);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <UnsavedChangesContext.Provider value={{ registerGuard }}>
      {children}
      {pending && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed", inset: 0, background: "rgba(15,15,25,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
            padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) handleCancel(); }}
        >
          <div style={{
            background: "var(--bg-1)", borderRadius: 14, boxShadow: "var(--sh-3)",
            border: "1px solid var(--bd-2)", width: "100%", maxWidth: 400, padding: 22,
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 18 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 9, background: "var(--warn-soft)",
                color: "var(--warn)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <AlertTriangle size={17} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink-1)" }}>Unsaved changes</div>
                <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 3, lineHeight: 1.5 }}>
                  You have changes on this page that haven&apos;t been saved. Save them before leaving?
                </div>
              </div>
            </div>

            {saveError && (
              <div style={{ marginBottom: 14, color: "var(--danger)", background: "var(--danger-soft)", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, fontWeight: 500 }}>
                {saveError}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={handleCancel} disabled={saving}
                style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--bd-2)", background: "var(--bg-1)", color: "var(--ink-2)", fontSize: 13, fontWeight: 600, cursor: saving ? "default" : "pointer" }}>
                Cancel
              </button>
              <button type="button" onClick={handleDiscard} disabled={saving}
                style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--bd-2)", background: "var(--bg-1)", color: "var(--danger)", fontSize: 13, fontWeight: 600, cursor: saving ? "default" : "pointer" }}>
                Discard
              </button>
              <button type="button" onClick={() => void handleSaveAndContinue()} disabled={saving}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,var(--pu) 0%,var(--pu-deep) 100%)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? (<><Loader2 size={13} className="ucg-spin" /> Saving…</>) : "Save changes"}
              </button>
            </div>
          </div>
          <style jsx>{`
            .ucg-spin { animation: ucg-rotate 0.8s linear infinite; }
            @keyframes ucg-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          `}</style>
        </div>
      )}
    </UnsavedChangesContext.Provider>
  );
}
