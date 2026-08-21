# Keep the 30-day session; add basic login rate-limiting

The app currently has a 30-day session TTL and **no rate-limiting** on password attempts —
unlimited guesses against the single shared password. The Claude Design handoff's "locked by
default" language implied re-checking this.

Decided to keep the 30-day session — this is a single-user, local-first app with no shareable
URL exposing it to other people; re-locking on every visit is friction with no real security
benefit for that threat model. But the missing rate-limit is a genuine gap regardless of the
redesign (it predates it and isn't specific to it): add a basic lockout (e.g. exponential
backoff after 5 failed attempts) since it closes a real hole at low cost, independent of the
session-length question.
