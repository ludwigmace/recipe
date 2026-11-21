import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Recipe — your household cookbook",
  description: "A calm, shared place to save and cook from recipes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
