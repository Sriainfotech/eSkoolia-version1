import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import "react-toastify/dist/ReactToastify.css";
import { RequiredFieldMarker } from "@/components/layout/RequiredFieldMarker";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "School ERP",
  description: "Professional school ERP rewrite UI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${playfairDisplay.variable} h-full`}
    >
      {/* h-full + overflow-hidden on <body> prevents any page-level scroll;
          each route segment owns its own internal scroll area. */}
      <body className="h-full overflow-hidden">
        {children}
      </body>
    </html>
  );
}
