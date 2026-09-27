# Current: Phase 2, leveling pace + `/progress`

Spec and decisions: [plan.md](plan.md#phase-2-leveling-pace). Phase 1's checklist and review are in git history
(`245b2de`); its decisions are summarized in plan.md.

## Before starting

- [x] Confirm the open questions in plan.md: stale threshold 3 days, `/progress` public

## Implementation

- [x] `src/leveling.ts`: move `MAX_LEVEL` here from `src/commands/level.ts` (update imports), add
      `STALE_AFTER_DAYS`, `getPace`, `getEtaDays`, `isStale`, `formatPace` + tests (single record, < 1 day span,
      same-level refresh, pace 0, at 60, stale at 60)
- [x] `src/db/getFirstRecord.ts` (oldest record, limit 1) + test asserting the exact query
- [x] Daily report: first record per character in parallel with the 24h query, pace in each row, 💤 for stale
      characters + update `tests/dailyReport.test.ts`
- [x] `autocompleteCharacters`: suggest the characters of the `user` option's user when it's filled in + tests
      (`/level` and `/remove-character` have no `user` option, so they're unchanged)
- [x] `src/commands/progress.ts` via the `add-command` skill: `user` + `character` options, all characters when
      `character` is omitted, one embed field each, ETA footer, public with no mentions, ephemeral errors;
      register in `src/index.ts` + tests for every branch (self/other user, named/unknown/omitted character,
      0 characters, no level yet, no pace, at 60, stale)
- [x] README: `/progress`, pace and 💤 in the report
- [x] Verify: `npm run build && npm test && npm run lint && npx cdk synth`
- [ ] You run: `npm run deploy:commands` (new command) and `npm run deploy`, then check in Discord: `/progress` embed
      renders cleanly (fields stacked, timestamps, no pings), `character` autocompletes another user's characters
      once `user` is set, and the next daily report shows pace and 💤

## Review

Implemented and verified locally: build, 134 tests, lint, prettier and `cdk synth` pass. Not yet deployed.

Decisions made during implementation:

- The report leaves the pace out of a row until there is one: `Lv 12 — · — · updated` would read badly next to the
  24h change's `—`. `/progress` shows it as "Pace — (needs records at least a day apart)" instead. plan.md updated.
- `getPace` takes the first record as optional, so callers don't need to handle a leveled character without records
  (which `recordLevel`'s transaction rules out anyway).
- `/progress` field names are the character names, markdown-escaped. The embed description mentions the user, which
  doesn't ping inside an embed. `allowed_mentions: { parse: [] }` is set anyway, like `/level`.
- An ETA of one day says "~1 day". A pace of 0 shows "no ETA to 60".
- `DAY_MS` moved to `src/leveling.ts` and is shared by the report.
- Autocomplete reads the `user` option by name, so any future command with a `user` option gets the same behavior.
