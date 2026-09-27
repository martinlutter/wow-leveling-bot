# Lessons

## Don't pass a platform constraint on to the user as a UX trade-off without checking the platform's options

- Mistake: I proposed "`/level` errors will be public too" because the deferred reply's visibility is fixed. But
  Discord follow-ups each choose their own visibility, so errors can be ephemeral and successes public.
- Rule: before presenting a UX downside that comes from an API limitation, check whether the API has another route
  (other endpoints, per-message flags, ordering of calls). Only present the downside if none exists.

## Check how a workaround renders, not just whether it works

- Mistake: public `/level` replies used edit → public follow-up → delete. It worked, but Discord shows the follow-up as
  a reply to the deleted message, which looked broken.
- Rule: when chaining API calls to get around a platform limit, check the visible side effects in the client
  (reply references, "edited" markers, "used /command" headers) before choosing it, and name them in the plan.

## Don't create things implicitly from free-text input

- Mistake: `/level character:<typo or new name>` silently created a new character. The user saw a "second character"
  appear and took it for a bug.
- Rule: user-typed identifiers should look up existing entities and fail with a hint; creation gets its own explicit
  action. Implicit creation is only OK for an unambiguous default (e.g. the user's first character).
