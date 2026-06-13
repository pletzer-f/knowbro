// The KnowBro disclosed-line mark + lowercase `knowbro.` wordmark (IBM Plex
// Mono, Signal-Blue dot). The mark's revealed middle segment is the only
// Signal Blue — inference disclosed. See the design system brand book.

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="KnowBro mark">
      <rect x="9" y="13" width="30" height="4.2" rx="2.1" fill="var(--brand)" />
      <rect x="9" y="22" width="16" height="4.2" rx="2.1" fill="var(--brand)" />
      <rect x="28" y="22" width="11" height="4.2" rx="2.1" fill="var(--accent)" />
      <rect x="9" y="31" width="23" height="4.2" rx="2.1" fill="var(--brand)" />
    </svg>
  );
}

export default function Logo({ markSize = 26 }: { markSize?: number }) {
  return (
    <span className="kb-wordmark">
      <LogoMark size={markSize} />
      knowbro<span className="dot">.</span>
    </span>
  );
}
