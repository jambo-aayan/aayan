import { Sidebar } from "@/components/sidebar";
import { ToastProvider } from "@/components/toast/toast-provider";
import styles from "./shell.module.css";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className={styles.shell}>
        <Sidebar />
        <main className={styles.main}>{children}</main>
      </div>
    </ToastProvider>
  );
}
