"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Nav() {
  const router = useRouter();

  const signOut = async () => {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <nav>
      <Link href="/">Analyse</Link> | <Link href="/dossiers">My dossiers</Link> |{" "}
      <Link href="/settings">Source preferences</Link> |{" "}
      <button type="button" onClick={signOut}>
        Sign out
      </button>
      <hr />
    </nav>
  );
}
