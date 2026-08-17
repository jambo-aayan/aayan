"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import styles from "./logout-button.module.css";

export function LogoutButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogout() {
    setLoading(true);
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button type="button" className={styles.button} onClick={handleLogout} disabled={loading}>
      <LogOut size={16} strokeWidth={2} />
      {loading ? "Signing out…" : "Log out"}
    </button>
  );
}
