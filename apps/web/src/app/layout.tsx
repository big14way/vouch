import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Providers, PwaRegister } from "@/components/providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap", weight: ["400", "600"] });

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://vouch-rouge.vercel.app";

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

export const viewport: Viewport = { themeColor: "#0A6C4E", width: "device-width", initialScale: 1, viewportFit: "cover" };

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
