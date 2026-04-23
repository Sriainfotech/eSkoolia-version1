import { Manrope, Playfair_Display } from "next/font/google";

const studentDisplayFont = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-playfair-display",
});

const studentBodyFont = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-manrope",
});

export const studentThemeClassName = `${studentBodyFont.variable} ${studentDisplayFont.variable} student-theme`;
