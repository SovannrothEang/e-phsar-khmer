import { Kantumruy_Pro } from "next/font/google";

/**
 * Khmer script face. The global stack keeps Times New Roman first, so Latin
 * text renders in Times New Roman while Khmer glyphs fall through to this
 * font; systems without Times New Roman also get a usable Latin fallback here.
 */
export const kantumruyPro = Kantumruy_Pro({
  subsets: ["khmer", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-kantumruy-pro",
  display: "swap",
});
