import Link from "next/link";
import styles from "./welcome.module.css";

export default function WelcomePage() {
  return (
    <main className={styles.welcome}>
      <div className={styles.eyebrow}>Welcome back</div>
      <h1 className={styles.title}>
        Take a moment first.
        <br />
        Your pillars can wait.
      </h1>
      <p className={styles.sub}>
        No numbers here — just a quiet start. When you&rsquo;re ready, Health and
        Finances are one click away.
      </p>
      <Link href="/today" className={styles.continue}>
        Continue
      </Link>
    </main>
  );
}
