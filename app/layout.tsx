// Deliberately unstyled. Visual design comes later from a separate design pass;
// keep markup semantic so restyling is a CSS/component-skin job, not a rewrite.
import type { ReactNode } from "react";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "WBA Company Intelligence (engine prototype)",
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
