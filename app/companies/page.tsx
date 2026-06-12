// The companies dashboard moved to the home page; old links keep working.
import { redirect } from "next/navigation";

export default function CompaniesRedirect() {
  redirect("/");
}
