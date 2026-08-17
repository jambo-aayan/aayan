import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { Card } from "@/components/card";
import { LogoutButton } from "@/components/logout-button";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" backHref="/today" />
      <div className={pageStyles.content}>
        <Card title="Session">
          <LogoutButton />
        </Card>
      </div>
    </>
  );
}
