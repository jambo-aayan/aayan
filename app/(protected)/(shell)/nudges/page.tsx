import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { PageTitle } from "@/components/page-title";
import { NudgesList, type NudgeRow } from "@/components/nudges/nudges-list";
import { getNudges, type NudgeFilter } from "@/lib/nudges/data";

function parseFilter(raw: string | string[] | undefined): NudgeFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "all" || value === "snoozed" ? value : "unread";
}

export default async function NudgesPage({ searchParams }: { searchParams: Promise<{ filter?: string | string[] }> }) {
  const filter = parseFilter((await searchParams).filter);
  const nudges = await getNudges(filter);
  const rows: NudgeRow[] = nudges.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    createdAt: n.createdAt.toISOString(),
    readAt: n.readAt?.toISOString() ?? null,
    snoozedUntil: n.snoozedUntil?.toISOString() ?? null,
  }));

  return (
    <>
      <PageHeader backHref="/today" />
      <div className={pageStyles.content}>
        <PageTitle eyebrow="Reminders" title="Nudges" lede="Everything the app wants to tell you, and nothing it doesn't." />
        <NudgesList filter={filter} nudges={rows} />
      </div>
    </>
  );
}
