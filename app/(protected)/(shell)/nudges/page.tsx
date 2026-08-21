import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { Card } from "@/components/card";

/** Stub landing page — the Nudges nav item and its sidebar badge need
 * somewhere real to point per #54's spec, but the eligibility engine and
 * full page are their own ticket (#69/#70). */
export default function NudgesPage() {
  return (
    <>
      <PageHeader title="Nudges" backHref="/today" />
      <div className={pageStyles.content}>
        <Card title="Coming soon">
          <p>The Nudges eligibility engine and full page land in their own ticket.</p>
        </Card>
      </div>
    </>
  );
}
