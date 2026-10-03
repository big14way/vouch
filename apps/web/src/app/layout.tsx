import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Providers, PwaRegister } from "@/components/providers";
import "./globals.css";

// Self-hosted (OFL, see assets/fonts): the build never depends on fetching Google Fonts.
const inter = localFont({ src: "../assets/fonts/inter-latin-opsz.woff2", variable: "--font-inter", display: "swap", weight: "100 900" });
const mono = localFont({ src: "../assets/fonts/jetbrains-mono-latin.woff2", variable: "--font-jetbrains", display: "swap", weight: "100 800" });

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://vouchhq.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: "Vouch — pay when it's delivered", template: "%s · Vouch" },
  description: "Pay when it's delivered. Get paid when it's verified. A conditional-settlement layer for agent and human work on Tempo and Base.",
  openGraph: { type: "website", siteName: "Vouch", url: appUrl, title: "Vouch — pay when it's delivered", description: "Lock the money against a written scope. An independent check verifies the delivery. Payment releases under your rules." },
  twitter: { card: "summary_large_image" },
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
  appleWebApp: { capable: true, title: "Vouch", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#0b1220", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="bg-bg text-text">
        <Providers>
          {children}
          <PwaRegister />
        </Providers>
      </body>
    </html>
  );
}
