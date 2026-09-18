import { ExamFocusProvider } from "@/contexts/ExamFocusContext";

export default function ExamsLayout({ children }: { children: React.ReactNode }) {
  return <ExamFocusProvider>{children}</ExamFocusProvider>;
}
