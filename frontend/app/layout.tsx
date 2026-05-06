import type { Metadata } from "next";
import { DM_Sans, Playfair_Display, Instrument_Sans, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import "react-toastify/dist/ReactToastify.css";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });
const playfairDisplay = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap" });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400","500","600","700"], variable: "--font-instrument", display: "swap" });
const inter = Inter({ subsets: ["latin"], weight: ["400","500","600","700"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400","500"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "School ERP",
  description: "Professional school ERP rewrite UI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${playfairDisplay.variable} ${instrument.variable} ${inter.variable} ${mono.variable} h-full`}
    >
      {/* h-full + overflow-hidden on <body> prevents any page-level scroll;
          each route segment owns its own internal scroll area. */}
      <body className="h-full overflow-hidden">
        {children}
      </body>
    </html>
  );
}
