import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blue Ocean Internal",
  description: "Internal accounting and operations tool for Blue Ocean Chemicals staff.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
