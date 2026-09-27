# Current: Phase 1, `/level` command + daily report

Spec, decisions and data model: [plan.md](plan.md#phase-1-recording--daily-report).

- [x] DynamoDB storage via the `add-dynamodb-storage` skill: deps, `src/clients/db.ts`, table in `app.config.ts`
      (RETAIN), `TABLE_NAME` for the Execute + report lambdas, `createAttributeNames` util
- [x] Models `src/db/model/character.ts` and `src/db/model/levelRecord.ts` (keys, mappers) + tests
- [x] Data access `src/db/getUserCharacters.ts`, `src/db/getAllCharacters.ts`, `src/db/recordLevel.ts`
      (throws a typed error when the condition fails), `src/db/getLevelAt.ts` + tests asserting the exact requests
- [x] Public results: `execute` can mark a result public; `src/execute.ts` does edit → public follow-up → delete.
      Everything else keeps today's ephemeral behavior + tests
- [x] `src/quotes.ts` (curated list + `randomQuote()`)
- [x] `src/commands/level.ts`: name normalization/validation, character resolution, level check, record, public reply
      with the change since the previous record and a quote, 🎉 at 60 + tests for every branch
- [x] `src/dailyReport.ts` scheduled lambda: sorted lines, "no level-ups" line, empty state + tests
- [x] `app.config.ts`: report lambda, EventBridge Scheduler schedule, `REPORT_CHANNEL_ID` env; `.env.dist`
- [x] README: commands, `REPORT_CHANNEL_ID`, invite permissions (Send Messages + Embed Links in the report channel)
- [x] Verify: `npm run build && npm test && npm run lint && npx cdk synth`
- [ ] You run: `npm run deploy:commands` and `npm run deploy`, then check in Discord that errors are private and
      successful `/level` replies are public

## Follow-up after the first deploy

- [x] Public `/level` replies: post with `channels.createMessage` + delete the ephemeral reply (no more "reply to a
      deleted message"); public follow-up as fallback when posting fails; Execute lambda retries off
- [x] Explicit characters: `/add-character <name>` (validation, duplicates), characters without a level until the
      first `/level`; `recordLevel` condition `attribute_not_exists(level) OR level <= :level`
- [x] `/level character:` must name an existing character; omitted name keeps the 0/1/2+ behavior
- [x] `/remove-character <name>` with ephemeral Yes/No buttons: button routing by `custom_id` prefix
      (`Command.handleButton`, `DEFERRED_UPDATE_MESSAGE`), deletes the character and its history
- [x] Daily report leaves out characters without a level
- [x] Tests, README, CLAUDE.md, add-command skill, plan.md
- [x] Verify: build, 96 tests, lint, `cdk synth`
- [x] Autocomplete own characters for `/level character` and `/remove-character name` (`Command.autocomplete`, answered
      in the Interaction lambda, which now has `TABLE_NAME` + read access); 104 tests, lint, synth pass
- [ ] You run: `npm run deploy:commands` (new commands, autocomplete flags) and `npm run deploy`, then check in Discord:
      `/level` posts a plain message; `/remove-character` buttons work; both options suggest your characters

## Review

Implemented and verified locally: build, 56 tests, lint and `cdk synth` pass. Not yet deployed.

Decisions made during implementation:

- `Command.execute` returns a `CommandResponse`: Discord's callback data plus an optional `public` flag, which
  `execute.ts` strips before sending. `/ping` and error replies are unchanged (ephemeral).
- A lower level is refused only by the DynamoDB condition (no separate pre-check), so the normal case and a race give
  the same message: "**X** is already above level N. Levels can't go down."
- A 1–2 word name check uses the normalized name; a whitespace-only name is rejected with the same message.
- Public `/level` replies set `allowed_mentions: { parse: [] }` because names are user input (e.g. `@everyone`); names
  are markdown-escaped in replies and the report.
- Report: a character with no record older than 24h shows 🆕 and doesn't count as a level-up. Ties in level are sorted
  by name. If the list exceeds the 4096-char embed limit, rows are cut from the end with "…and N more".
- Report lambda has a 30s timeout (one `getLevelAt` query per character, in parallel) and read-only table access.
- Formatting shared by `/level` and the report lives in `src/format.ts`, so the report bundle doesn't pull in the command.
- Docs: README (commands, report, `REPORT_CHANNEL_ID`, invite permissions `18432`), CLAUDE.md request flow, and the
  `add-command` skill's "post publicly" gotcha.

Still to verify in Discord: the edit → public follow-up → delete sequence (fallback in plan.md if it misbehaves).
