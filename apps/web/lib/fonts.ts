import localFont from "next/font/local";

export const inter = localFont({
  src: "../fonts/inter-latin.woff2",
  weight: "400 700",
  variable: "--font-inter",
  display: "swap",
});

export const nunitoSans = localFont({
  src: "../fonts/nunito-sans-latin.woff2",
  weight: "400 700",
  display: "swap",
});
