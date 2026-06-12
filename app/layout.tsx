// Deliberately unstyled. Visual design comes later from a separate design pass;
// keep markup semantic so restyling is a CSS/component-skin job, not a rewrite.
import type { ReactNode } from "react";

export const metadata = {
  title: "WBA Company Intelligence (engine prototype)",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
