import { redirect } from "next/navigation";

/** All Tasks is superseded by the Lists-first /tasks page. Kept as a
 * redirect (query string preserved) rather than a 404 so any old
 * bookmark/link still lands somewhere useful. */
export default async function AllTasksRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") qs.set(key, value);
  }
  const suffix = qs.toString();
  redirect(suffix ? `/tasks?${suffix}` : "/tasks");
}
