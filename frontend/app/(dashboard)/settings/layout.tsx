import { UnsavedChangesProvider } from "@/contexts/UnsavedChangesContext";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <UnsavedChangesProvider>{children}</UnsavedChangesProvider>;
}
