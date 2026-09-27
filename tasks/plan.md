# WoW leveling bot: plan

A Discord bot that records the leveling progress of players' characters in World of Warcraft: Forever, posts a daily
progress report, and compares players' leveling speed.

The current phase's checklist is in [todo.md](todo.md).

## Phases

| Phase | Scope                                                                    | Status              |
| ----- | ------------------------------------------------------------------------ | ------------------- |
| 1     | Storage, `/level` command, daily report (level, 24h change, last update) | Built, not deployed |
| 2     | Leveling pace (levels/day), stale markers, `/progress` command           | Later               |
| 3     | `/leaderboard`, `/compare`, milestones, weekly "fastest", charts?        | Later               |

Each phase is planned in detail in `todo.md` before it starts, and gets its own review.

## Game facts

- Level cap is 60 (`MAX_LEVEL` constant in code).
- The XP curve of WoW: Forever is unknown, so speed is measured in plain levels, not XP. Keep in mind that this favors
  low-level characters: late levels take much longer than early ones.
- Character names can have 2 parts (e.g. `Grom Hellscream`).

## Phase 1: recording + daily report

### Character names

Max 32 chars. A typed name is trimmed and inner whitespace collapsed to one space. Matching is case-insensitive; the
casing typed when adding is kept for display.

### `/add-character <name>` and `/remove-character <name>`

- Characters are created explicitly (a typed `/level` name used to create one silently, which was confusing).
- `/add-character`: more than 2 parts is rejected; an existing name (case-insensitive) is rejected. The character has no
  level until its first `/level`. Ephemeral reply.
- `/remove-character`: ephemeral Yes/No buttons; Yes deletes the character and its whole level history. No word-count
  validation, so auto-created characters named after a 3-word nickname can still be removed. `name` autocompletes.

### `/level <level> [character]`

- `level`: integer 1–60, enforced by Discord.
- `character`: optional; must be an existing character of the user (no word-count validation, see above), otherwise an
  ephemeral error pointing to `/add-character`. Autocompletes the user's own characters (name contains the typed text,
  case-insensitive, max 25, shown with their level). Autocomplete is answered by the Interaction lambda directly (it
  can't be deferred), so that lambda has read access to the table.
- Multiple characters per Discord user. When `character` is omitted:
  - 0 characters → create one named after the user (server nickname → display name → username; not validated)
  - 1 character → use it
  - 2+ characters → no record; ephemeral reply listing them and asking for `character`
- A level lower than the character's current level is rejected. Levels never decrease, so the current level is the
  highest one recorded. The same level is accepted and refreshes "last updated". Enforced with a DynamoDB condition, so
  racing commands can't break it.
- Replies: validation errors are ephemeral (only the caller sees them), a successful record is public. It shows the
  change since the previous record, a random WoW quote, and 🎉 on reaching 60.
- Quotes: a curated, hard-coded list in `src/quotes.ts`. No public API serves game quotes (Blizzard's Game Data API needs
  OAuth credentials and has none).

### Public vs. ephemeral replies

Discord fixes the visibility of the deferred reply (currently ephemeral for every command). So `execute` can mark its
result public, and `execute.ts` then posts it to the channel with `channels.createMessage` and deletes the ephemeral
reply. This needs Send Messages in every channel `/level` is used in. A public follow-up needs no permissions but shows
as a reply to the deleted ephemeral message (tried first, rejected for that); it remains the fallback when posting fails.
The Execute lambda has async retries off, so a failure after posting can't post twice.

### Daily report

- Posted at 07:00 Central European time, following DST (EventBridge Scheduler, `TimeZone.EUROPE_BERLIN`, identical to
  any other CET/CEST zone), to the channel in `REPORT_CHANNEL_ID`.
- One embed (4096-char limit; mentions in embeds don't ping anyone). Characters sorted by level desc, one line each:
  `name (@user) Lv N ▲k | — · updated <t:…:R>`. `<t:…:R>` renders as "3 hours ago" in each reader's timezone.
- Characters without a level are left out.
- Posts even when nothing changed, with a "No level-ups in the last 24 hours" line. Empty-state message when nobody has
  recorded yet.
- The 24h change is computed from the level history, not from state saved by the previous report, so the job is
  stateless and a retry gives the same result.

### Data model (single DynamoDB table, `pk`/`sk`)

| Item      | pk                            | sk                     | Attributes                       |
| --------- | ----------------------------- | ---------------------- | -------------------------------- |
| Character | `CHARACTERS`                  | `<userId>#<nameLower>` | userId, name, level?, updatedAt? |
| Record    | `RECORD#<userId>#<nameLower>` | `<ISO timestamp>`      | level                            |

Access patterns:

- a user's characters → query `pk=CHARACTERS`, `sk begins_with <userId>#` (user IDs never contain `#`, so the prefix is
  exact even though names may)
- all characters for the report → query `pk=CHARACTERS`. One partition is fine at a single guild's scale.
- level at a point in time (report delta, later pace) → query `pk=RECORD#…`, `sk <= time`, newest first, limit 1
- one character → get `pk=CHARACTERS`, `sk=<userId>#<nameLower>`
- adding a character → put with `attribute_not_exists(pk)` (no level/updatedAt until the first record)
- recording a level → one `TransactWrite`: put the Record + put the Character with the condition
  `attribute_not_exists(level) OR level <= :level` (covers a new character and an added one without a level)
- removing a character → delete the Character, then query its `RECORD#…` keys and batch-delete them

## Phase 2: leveling pace

- Pace = levels/day from the character's first record to its latest one, i.e. all time. Simple and understandable. Its
  bias toward low-level characters is accepted (see Game facts).
- Pace can't be computed for a character with a single record, or one whose records are less than ~1 day apart.
  Show "—" until then.
- Daily report: pace column, and a stale marker for characters with no update for N days.
- `/progress [user] [character]`: history summary (first record, current level, levels gained), pace, and ETA to 60 at
  that pace. The ETA is optimistic because late levels are slower.
- Open questions: stale threshold (3 days?); does `/progress` reply publicly or ephemerally?

## Phase 3: comparison and fun

- `/leaderboard [period: 24h | 7d | 30d | all]`: ranking by levels gained in the period.
- `/compare <user1> <user2>`: head-to-head, e.g. current levels, pace, and days each took to reach shared milestones.
  Comparing "days to reach level N" is fair because it's the same levels for both.
- Milestones: announce reaching 10/20/…/60, in the `/level` reply or the next report.
- Weekly "⚡ fastest this week" line in the report.
- Charts (maybe): level over time as an image embed. QuickChart.io is the easiest route but is an external service;
  rendering with canvas inside the Lambda avoids that but adds bundle weight.
- Open questions: which of these are wanted, and in which order.

## Backlog

- `/level undo` to fix a mistyped level (phase 1 rejects lower levels, so a too-high typo can't be corrected).
- Quote in the daily report too.
