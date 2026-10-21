import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "ChogXBet",
  icons: { icon: "/chog-logo.png" },
  // The share image is the static app/opengraph-image.png; duel pages can override with their own /og?asset=…&call=…&when=… URL.
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} scroll-smooth motion-reduce:scroll-auto`}>
      <body className="min-h-screen font-sans antialiased">
        <NextTopLoader color="#6e56e8" showSpinner={false} />
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
