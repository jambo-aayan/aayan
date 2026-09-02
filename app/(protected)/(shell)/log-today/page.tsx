import { redirect } from "next/navigation";

/** /log-today (the old fixed daily logging sheet) is superseded by /log —
 * every field it tracked is now a Metric, loggable there alongside
 * everything else (#182/#184). Kept as a redirect rather than a 404 so any
 * old bookmark/link still lands somewhere useful, same pattern as
 * /all-actions's own redirect to /tasks. */
export default function LogTodayPage() {
  redirect("/log");
}
