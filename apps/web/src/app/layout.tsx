import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Vouch", description: "Pay when it's delivered. Get paid when it's verified." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
