"use client";

import { useState } from "react";
import { cycleTodayCheckIn } from "@/lib/habits/actions";
import { nextCheckInLevel } from "@/lib/habits/check-in";
import { withRetry } from "@/lib/with-retry";
import type { DailyFocusHabit } from "./daily-focus-types";

/** Optimistic tap-to-cycle for the sidebar/drawer's Daily-focus habit rows —
 * the tri-state dot is tappable there too per the handoff's spec ("Tapping
 * cycles none -> full -> partial -> none... 13px in the sidebar widget").
 * Shared between Sidebar and MobileNavDrawer so the optimistic-update logic
 * isn't duplicated. */
export function useDailyFocusHabits(initial: DailyFocusHabit[]) {
  const [habits, setHabits] = useState(initial);
  // The layout re-fetches this list on every server navigation — track the
  // prop we last synced from so a fresh `initial` (a new nav) resets local
  // state during render, rather than freezing at whatever loaded on first
  // mount. See https://react.dev/learn/you-might-not-need-an-effect
  // ("Adjusting state when a prop changes").
  const [syncedInitial, setSyncedInitial] = useState(initial);
  if (initial !== syncedInitial) {
    setSyncedInitial(initial);
    setHabits(initial);
  }

  async function toggle(habit: DailyFocusHabit) {
    const newLevel = nextCheckInLevel(habit.todayLevel);
    setHabits((prev) => prev.map((h) => (h.id === habit.id ? { ...h, todayLevel: newLevel } : h)));
    const result = await withRetry(() => cycleTodayCheckIn(habit.id));
    if (!result.ok) {
      setHabits((prev) => prev.map((h) => (h.id === habit.id ? habit : h)));
    }
  }

  return { habits, toggle };
}
