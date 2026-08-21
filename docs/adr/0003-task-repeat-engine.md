# Extend Task.repeatRule to match Habit's schedule richness, not build a new engine

Corrects an earlier version of this ADR written from the Claude Design handoff's claim that
"repeat rules... have no recurrence engine behind them." That's not accurate — a real engine
already exists (`nextOccurrenceDate`, wired into `completeTask`: completing a repeating Task
creates its next occurrence with a recalculated due date, same List/Pillar/Area/Goal/Tags).

The actual gap is narrower: `TaskRepeatRule` only covers `Daily/Weekdays/Weekly/Monthly/Custom`,
while the handoff's Task detail sheet implies the same rule richness as Habit's schedule
(`Daily/Weekdays/Selected weekdays/Weekly/Every N days/Monthly/Custom`). Decided to extend
`TaskRepeatRule` to match rather than leave the two schedule pickers inconsistent — a user who
learns "every 3 days" on a Habit shouldn't hit a narrower set of options on a Task's repeat rule.
`Selected weekdays` and `Every N days` need the same extra fields Habit already carries
(`scheduleWeekdays`/`scheduleIntervalN`-equivalent), computed into `nextOccurrenceDate` the same
way `lib/habits/schedule.ts`'s `habitOccursOn` already handles them for Habit.
