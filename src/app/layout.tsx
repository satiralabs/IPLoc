import type { Metadata } from "next";
import "./globals.css";

// Note: this project deliberately does NOT use next/font/google.
// The original template fetched Geist from Google Fonts at build time,
// which makes `npm run build` fail outright on any machine/network where
// fonts.googleapis.com is unreachable. A system font stack needs no
// network, builds anywhere, and loads faster for visitors.

export const metadata: Metadata = {
  title: "IPLoc — IP Location Tool",
  description: "Look up the approximate location, timezone, ISP and coordinates of your own IP address or any public IP. No API key needed.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
