import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "P4I Office — Sistem Persuratan Internal",
  description: "Aplikasi internal pengelolaan draf, persetujuan, dan persuratan resmi Yayasan P4I",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
