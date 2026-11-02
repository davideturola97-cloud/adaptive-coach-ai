import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Manrope } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { PwaRegister } from "@/components/pwa";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });
const barlow = Barlow_Condensed({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-barlow", display: "swap" });

export const metadata: Metadata = {
  title: "Adaptive Coach AI",
  description: "Il tuo allenatore personale per corsa, bici, nuoto e palestra, che si adatta alla tua settimana.",
  applicationName: "Adaptive Coach AI",
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Coach", statusBarStyle: "black" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0a0d12",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${manrope.variable} ${barlow.variable}`}>
      <body>
        <PwaRegister />
        <AppShell demo={!isSupabaseConfigured()}>{children}</AppShell>
      </body>
    </html>
  );
}
