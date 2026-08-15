import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { Card } from "@/components/card";
import { ThoughtsList } from "@/components/thoughts/thoughts-list";
import { getAllThoughts } from "@/lib/thoughts/data";

export default async function ThoughtsPage() {
  const thoughts = await getAllThoughts();

  return (
    <>
      <PageHeader title="Thoughts" backHref="/pillars" />
      <div className={pageStyles.content}>
        <Card>
          <ThoughtsList initialThoughts={thoughts} />
        </Card>
      </div>
    </>
  );
}
