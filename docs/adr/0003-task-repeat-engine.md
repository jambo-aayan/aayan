# Build a real recurrence engine for Task.repeatRule in v1

`Task.repeatRule` has existed since the original Tasks build but never did anything — the field
is stored and displayed, with no code that acts on it. The Claude Design handoff surfaces this
as a known stub rather than asking to fix it.

Decided to build a real engine rather than carry the stub forward into the redesign: on
completing a Task with a non-null `repeatRule`, create the next occurrence (same List, Pillar,
Area, Goal, Tags; a recalculated due date) rather than leaving the field cosmetic. A repeat rule
that visibly implies recurrence but silently does nothing is worse than not showing the control
at all — the redesign is the point at which this either gets built or the control should be
removed, and removing a feature the user has been shown isn't the better option.
