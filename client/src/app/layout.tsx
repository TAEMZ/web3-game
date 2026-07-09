import "@/styles/globals.css";

import type { ReactNode } from "react";

import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { SITE_URL } from "@/lib/site";

import ContextProvider from "@/context/ContextProvider";

export const metadata = {
  title: "Chess Arena",
  description: "Play Chess online.",
  openGraph: {
    title: "Chess Arena",
    description: "Play Chess online.",
    url: SITE_URL,
    siteName: "Chess Arena",
    locale: "en_US",
    type: "website"
  },
  robots: {
    index: true,
    follow: false,
    nocache: true,
    noarchive: true
  },
  icons: {
    icon: [
      { type: "image/png", sizes: "32x32", url: "/favicon-32x32.png" },
      { type: "image/png", sizes: "16x16", url: "/favicon-16x16.png" }
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" }
  },
  manifest: "/site.webmanifest",
  metadataBase: new URL(SITE_URL)
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="overflow-x-hidden">
      <body className="overflow-x-hidden">
        <ContextProvider>
          <Header />

          <main className="mx-auto flex min-h-[70vh] w-full max-w-6xl justify-center px-4">
            {children}
          </main>
        </ContextProvider>

        <Footer />

        {/* next/script issue: https://github.com/vercel/next.js/issues/43402 */}
        <script
          id="load-theme"
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.setAttribute("data-theme", localStorage.theme === "light" ? "arenaLight" : "arenaDark");`
          }}
        ></script>
      </body>
    </html>
  );
}
