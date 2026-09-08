/**
 * Shared light palette for the Examination module's regrouped pages
 * (Command Center, Exam Configuration, Exam Setup, ...). Copied from
 * components/academics/foundation/FoundationWorkspace.tsx so every one of
 * these screens reads as the same established design language, not a
 * one-off. Keep new exam pages importing this instead of re-declaring colors.
 */
export const examTheme = {
  page: "var(--page, #FAFAFB)",
  card: "#f8f8fc", cardBorder: "#dfdfea",
  border: "#E8ECEF", borderStrong: "#D2D7DC",
  ink1: "#1A1D1F", ink2: "#6F767E", ink3: "#9FA6AD",
  purple: "#5B4FCF", purpleSoft: "#EEF0FF", hoverSoft: "#F0F2F5",
  danger: "#DC2626", dangerSoft: "#FEF2F2",
  warn: "#B45309", warnSoft: "#FFFBEB",
  ok: "#15803D", okSoft: "#ECFDF5",
  info: "#2563EB", infoSoft: "#EFF6FF",
} as const;
