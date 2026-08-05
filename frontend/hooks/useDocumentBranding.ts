"use client";

import { useEffect, useState } from "react";
import { apiRequestWithRefresh, apiRequestWithRefreshResponse } from "@/lib/api-auth";

export type DocumentBrandingType = "student_verification" | "staff_onboarding" | "payslip";

const DECLARATION_FIELD: Record<DocumentBrandingType, string> = {
  student_verification: "declaration_student_verification",
  staff_onboarding: "declaration_staff_onboarding",
  payslip: "declaration_payslip",
};

interface UseDocumentBrandingResult {
  /** data: URL PNG of the school's configured header — null until loaded (or on fetch failure). */
  headerImageDataUrl: string | null;
  /** The school's centrally-configured declaration text for this document type, or the caller's fallback if not yet set. */
  declarationText: string;
  loading: boolean;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Fetches the school's centrally-configured document header (Settings >
 * Document Branding) plus the declaration text for a specific document
 * type. This is the one place every print/PDF feature in the app should
 * get its header/declaration from — never build or store a local copy.
 */
export function useDocumentBranding(type: DocumentBrandingType, fallbackDeclaration = ""): UseDocumentBrandingResult {
  const [headerImageDataUrl, setHeaderImageDataUrl] = useState<string | null>(null);
  const [declarationText, setDeclarationText] = useState(fallbackDeclaration);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [imgRes, settings] = await Promise.all([
          apiRequestWithRefreshResponse("/api/v1/settings/document-branding/header-image/"),
          apiRequestWithRefresh<Record<string, string>>("/api/v1/settings/document-branding/"),
        ]);
        if (cancelled) return;
        if (imgRes.ok) {
          const blob = await imgRes.blob();
          const dataUrl = await blobToDataUrl(blob);
          if (!cancelled) setHeaderImageDataUrl(dataUrl);
        }
        const fieldValue = settings?.[DECLARATION_FIELD[type]];
        if (!cancelled && fieldValue) setDeclarationText(fieldValue);
      } catch {
        // Silent — caller keeps its own fallback header/declaration.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [type]);

  return { headerImageDataUrl, declarationText, loading };
}
