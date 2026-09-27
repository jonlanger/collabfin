import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist_Mono, Instrument_Sans } from "next/font/google";
import { PrefsProvider } from "@/components/ui/prefs";
import { TipLayer } from "@/components/ui/tips";
import { Toast } from "@/components/ui/toast";
import { siteUrl } from "@/lib/supabase/env";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--ff-display", axes: ["opsz"], display: "swap" });
const sans = Instrument_Sans({ subsets: ["latin"], variable: "--ff-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--ff-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "Collabfin: plan your money together", template: "%s · Collabfin" },
  description: "A collaborative money-planning canvas. Link income, bills, accounts and goals, see real take-home pay with 2026 tax rates, and plan together live.",
  openGraph: { title: "Collabfin", description: "Plan your money together, on one canvas.", type: "website" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8fc" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0f1f" },
  ],
};

// Applies saved theme and accessibility choices before the first paint, so there's no flash.
const applyPrefs = `(function(){try{var p=JSON.parse(localStorage.getItem("collabfin-prefs-v2")||"{}"),r=document.documentElement;
if(p.theme==="light"||p.theme==="dark")r.setAttribute("data-theme",p.theme);
if(p.contrast)r.setAttribute("data-contrast","high");if(p.cbSafe)r.setAttribute("data-cb","safe");
if(p.reduceMotion)r.setAttribute("data-motion","reduce");if(p.spacing)r.setAttribute("data-spacing","wide");
if(p.focusStrong)r.setAttribute("data-focus","strong");if(p.textSize)r.style.setProperty("--ui-zoom",String(p.textSize/100));}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: applyPrefs }} />
      </head>
      <body>
        <PrefsProvider>
          {children}
          <Toast />
          <TipLayer />
        </PrefsProvider>
      </body>
    </html>
  );
}
