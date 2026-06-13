"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";

export default function Nav() {
  const router = useRouter();

  const signOut = async () => {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <nav className="kb-nav">
      <Link href="/" aria-label="KnowBro home">
        <Logo />
      </Link>
      <Link href="/">Companies</Link>
      <Link href="/analyse">Research</Link>
      <Link href="/settings">Sources</Link>
      <Link href="/account">Account</Link>
      <span className="kb-nav-spacer" />
      <ThemeToggle />
      <button type="button" className="kb-mini" onClick={signOut}>
        Sign out
      </button>
    </nav>
  );
}
