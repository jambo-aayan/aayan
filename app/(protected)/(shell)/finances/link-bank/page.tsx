import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { Card } from "@/components/card";
import { BankPicker } from "@/components/finance/bank-picker";
import { listAspsps, getLinkedBanks } from "@/lib/enable-banking/data";

const ERROR_MESSAGES: Record<string, string> = {
  missing_code: "The bank didn't return an authorization code — try connecting again.",
  state_invalid: "The connection request looked tampered with — try connecting again.",
  state_mismatch: "The connection request didn't match what was started — try connecting again.",
  session_failed: "Couldn't complete the connection with Enable Banking — try again.",
  save_failed: "Connected, but couldn't save the link — try again.",
};

export default async function LinkBankPage({
  searchParams,
}: {
  searchParams: Promise<{ linked?: string; error?: string }>;
}) {
  const { linked, error } = await searchParams;

  let aspsps: { name: string; country: string }[] = [];
  let loadError: string | null = null;
  try {
    aspsps = await listAspsps("GB");
  } catch {
    loadError = "Couldn't load the bank list from Enable Banking — check ENABLE_BANKING_APPLICATION_ID / ENABLE_BANKING_PRIVATE_KEY_B64 are set correctly.";
  }

  const linkedBanks = await getLinkedBanks();

  return (
    <>
      <PageHeader title="Link a bank" backHref="/finances" />
      <div className={pageStyles.content}>
        {linked && <Card>Connected. Its accounts now show up below.</Card>}
        {error && <Card>{ERROR_MESSAGES[error] ?? "Something went wrong — try again."}</Card>}
        <Card title="Available banks (UK)">
          {loadError ? <p>{loadError}</p> : <BankPicker aspsps={aspsps} />}
        </Card>
        <Card title="Linked banks">
          {linkedBanks.length === 0 ? (
            <p>None linked yet.</p>
          ) : (
            <ul>
              {linkedBanks.map((link) => (
                <li key={link.id}>
                  {link.aspspName} ({link.aspspCountry}) —{" "}
                  {Array.isArray(link.accounts) ? link.accounts.length : 0} account(s), valid until{" "}
                  {link.validUntil.toLocaleDateString("en-GB")}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
