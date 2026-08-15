import { redirect } from "next/navigation";
import { getValidSession } from "@/lib/auth/session";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authenticated = await getValidSession();
  if (!authenticated) {
    redirect("/login");
  }

  return <>{children}</>;
}
