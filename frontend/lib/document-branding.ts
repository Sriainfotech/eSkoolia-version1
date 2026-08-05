import { apiRequestWithRefreshResponse } from "@/lib/api-auth";

/**
 * Fetches the school's centrally-configured document header (Settings >
 * Document Branding) as a data: URL, for callers that only need the image
 * (e.g. a jsPDF-drawn receipt with no declaration text) — see
 * useDocumentBranding for the React-hook version that also pairs it with a
 * per-document-type declaration.
 */
export async function fetchDocumentHeaderImageDataUrl(): Promise<string | null> {
  try {
    const res = await apiRequestWithRefreshResponse("/api/v1/settings/document-branding/header-image/");
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Natural pixel size of a data: URL image — used to size a jsPDF/canvas
 * header proportionally regardless of whether it's a generated (wide,
 * ~16:3) or uploaded (any aspect ratio) header. */
export function getImageNaturalSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });
}
