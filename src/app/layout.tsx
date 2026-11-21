import type { Metadata } from "next";
import Script from "next/script";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "RecipeRepo — your household cookbook",
  description: "A calm, shared place to save and cook from recipes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Script id="theme-preference" strategy="beforeInteractive">
          {`try {
            var savedTheme = localStorage.getItem("recipe-repo-theme");
            if (savedTheme === "light" || savedTheme === "dark") {
              document.documentElement.dataset.theme = savedTheme;
            }
          } catch (_) {}`}
        </Script>
        <div className="site-content">{children}</div>
        <footer className="site-footer">RecipeRepo</footer>
        <ThemeToggle />
      </body>
    </html>
  );
}
