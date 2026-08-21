# Nudges: hold-and-coalesce, dedup by severity, re-evaluate on snooze wake

Nudges (the notification/reminder surface) needs behavior rules the Claude Design handoff
deliberately left undefined. Decided while grilling the handoff against the existing app:

- **Quiet hours (22:00–07:30): hold and deliver, coalesced, at the window's end** — not dropped
  silently. A held task-overdue or streak-at-risk reminder still matters in the morning; dropping
  it would make the feature unreliable for anything time-sensitive.
- **Deduplication: one notification per habit per day, highest-severity wins.** A streak-at-risk
  and an evening-check-in for the same habit must not both fire — streak-at-risk (a specific,
  time-pressured warning) takes priority over the generic check-in.
- **Coalescing: the morning brief is one notification per user**, not one per habit — "today's
  habits and top three tasks" is a single card, per the handoff's own wording.
- **Snooze re-evaluates the trigger on wake.** A task snoozed until tomorrow that gets completed
  in the meantime should not resurface — snoozing defers a check, it doesn't guarantee a future
  delivery regardless of state.
- **Read-state: opening the Nudges page does not mark items read.** Only the explicit "Mark all
  read" action, or acting on a card's primary action, does. This keeps the Unread/All/Snoozed
  filter and the badge count meaningful even if you just glance at the page.
- **Badge count: all unread, undifferentiated** — not filtered to high-severity only. The Nudges
  page itself handles triage once you're there; the badge's job is just "there's something."

These are genuine trade-offs (simpler alternatives exist for each — drop-silently, per-habit
notifications, mark-read-on-open) chosen deliberately for reliability and to avoid the feature
training the user to ignore it.
