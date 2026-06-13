// Styled with the KnowBro design system (Claude Design handoff). Tokens +
// global element layer live in app/globals.css; the markup stays semantic.
import type { ReactNode } from "react";
import "./globals.css";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";

// Apply the saved theme before first paint (no flash of the wrong theme).
const themeScript = `(function(){try{var t=localStorage.getItem('kb-theme');document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light');}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

import type { Metadata, Viewport } from "next";

// PWA: installable on desktop and mobile from the browser (install icon /
// "Add to Home Screen"). No offline mode — the engine is server-side anyway.
export const metadata: Metadata = {
  title: "WBA Company Intelligence",
  description: "Confidence-tagged company dossiers from public data.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icon-192.png", sizes: "192x192" }],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "WBA Intel",
  },
};

export const viewport: Viewport = {
  themeColor: "#1a1a2e",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en" data-theme="light">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {user && <Nav />}
        {children}
      </body>
    </html>
  );
}
