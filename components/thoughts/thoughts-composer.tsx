"use client";

import { useRouter } from "next/navigation";
import { ThoughtQuickAdd } from "./thought-quick-add";

type TagOption = { id: string; name: string; areas: { id: string; name: string }[] };

/** Thin client wrapper so the dedicated Thoughts page's server-rendered
 * list refreshes after a save, without lifting all of ThoughtsList's state
 * up into a client component. */
export function ThoughtsComposer({ tagOptions }: { tagOptions: TagOption[] }) {
  const router = useRouter();
  return <ThoughtQuickAdd tagOptions={tagOptions} multiline onSaved={() => router.refresh()} />;
}
