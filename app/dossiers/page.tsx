// "My dossiers" became "My companies" — dossiers are now time-stamped
// snapshots under a company. Old links keep working via this redirect.
import { redirect } from "next/navigation";

export default function DossiersRedirect() {
  redirect("/companies");
}
