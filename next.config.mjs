/**
 * NEXT_DIST_DIR lets verification builds write to a separate folder so they
 * never clobber a running dev server's .next/ (they share it by default,
 * which once broke the live app mid-session). Use `npm run build:check`
 * for safe verification; plain `npm run build` remains the real production build.
 */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
