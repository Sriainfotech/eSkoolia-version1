import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import "react-toastify/dist/ReactToastify.css";
import { RequiredFieldMarker } from "@/components/layout/RequiredFieldMarker";

export const metadata: Metadata = {
  title: "School ERP",
  description: "Professional school ERP rewrite UI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
       
        {children}
      </body>
    </html>
  );
}
