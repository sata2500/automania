import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  width: "device-width",
  initialScale: 1,
  // Note: userScalable and maximumScale intentionally omitted — WCAG 1.4.4 compliance
};

export const metadata: Metadata = {
  title: "Automania POD — Etsy Print-on-Demand Studio",
  description:
    "Automania POD, Etsy satıcıları için tasarlanmış güçlü bir Print-on-Demand stüdyosudur. Mockup düzenleme, toplu üretim ve Etsy SEO araçlarını tek bir yerde sunar.",
  keywords: ["etsy", "print on demand", "mockup", "tasarım", "toplu üretim", "pod", "automania"],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Automania",
  },
  formatDetection: {
    telephone: false,
  },
};

/**
 * Blocking inline script: runs before React hydration to prevent FOUC.
 * Reads saved theme from localStorage and immediately applies .dark class
 * to <html> — so the page never flashes the wrong theme.
 *
 * 2026 Best Practice: inline script in <head>, no async/defer, no React component.
 */
const themeScript = `
(function() {
  try {
    var STORAGE_KEY = 'automania_pod_theme_preference';
    var saved = localStorage.getItem(STORAGE_KEY);
    var root = document.documentElement;
    if (saved === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else if (saved === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      // system or unset: honour OS preference
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
        root.classList.remove('light');
      } else {
        root.classList.remove('dark');
        root.classList.add('light');
      }
    }
  } catch(e) {
    // Private browsing or localStorage blocked — default to dark
    document.documentElement.classList.add('dark');
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      // suppressHydrationWarning is required when using blocking scripts
      // that modify the <html> element before React hydration.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Blocking theme script — prevents flash of unstyled content (FOUC) */}
        {/* eslint-disable-next-line react/no-danger */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
