// Deliberately unstyled. Visual design comes later from a separate design pass;
// keep markup semantic so restyling is a CSS/component-skin job, not a rewrite.
import type { ReactNode } from "react";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";

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
    <html lang="en">
      <body>
        {user && <Nav />}
        {children}
      </body>
    </html>
  );
}
