import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { Card } from "@/components/card";

/** Stub landing page — the sidebar's Weekly-review CTA needs somewhere real
 * to point per #54's spec, but the guided 5-step flow is its own ticket
 * (#80). */
export default function WeeklyReviewPage() {
  return (
    <>
      <PageHeader title="Weekly review" backHref="/today" />
      <div className={pageStyles.content}>
        <Card title="Coming soon">
          <p>The guided 5-step Weekly Review ritual lands in its own ticket.</p>
        </Card>
      </div>
    </>
  );
}
