import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Owl & Compass — Relationship Memory & Prep Briefs",
  description: "Evidence-backed founder discovery, research, and relationship intelligence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100">
        {children}
      </body>
    </html>
  );
}
