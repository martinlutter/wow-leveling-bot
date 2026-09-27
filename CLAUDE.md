## Workflow Orchestration

### 1. Plan Mode Default

- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately – don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy

- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop

- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done

- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)

- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes – don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing

- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests – then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Task Management

0. **Overall plan**: `tasks/plan.md` holds the product spec, decisions and all phases; keep it current
1. **Plan First**: Write plan to `tasks/todo.md` with checkable items (current phase only)
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.

## Project

Serverless Discord bot for recording World of Warcraft leveling progress: no gateway/websocket. Discord POSTs interactions to an API Gateway → Lambda webhook. Infra is AWS CDK.

### Request flow

1. `src/index.ts` (Interaction lambda, 3s timeout): verifies the Ed25519 signature, answers PING with PONG; for
   application commands it async-invokes the Execute lambda and replies `DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE` (ephemeral).
   Discord drops the interaction if this takes >3s, so no real work here. The one exception is autocomplete, which
   can't be deferred: `Command.autocomplete` runs here (e.g. a DynamoDB query; the lambda has read access to the table).
2. `src/execute.ts` (Execute lambda, 10s timeout): finds the command, runs `execute`, sends the result with
   `discordApi.interactions.followUp`. A thrown error is logged and answered with a generic message.
   A result with `public: true` is posted to the channel with `channels.createMessage` and the ephemeral deferred reply
   is deleted (fallback without Send Messages: public follow-up). The Execute lambda has async retries off.
3. Button clicks: custom_id `<command name>:…` routes to that command's `handleButton`; the Interaction lambda replies
   `DEFERRED_UPDATE_MESSAGE` and Execute replaces the button's message with the result via `editReply`.

`src/dailyReport.ts` (DailyReport lambda) runs at 07:00 Europe/Berlin via EventBridge Scheduler and posts to
`REPORT_CHANNEL_ID`. Storage is one DynamoDB table (`src/db/`, access patterns in `tasks/plan.md`).

### Layout

- `src/commands/` one file per command exporting a `Command` (`{ builder, execute }`); registered in `commands` in `src/index.ts`
- `src/clients/` shared SDK clients
- `scripts/deployCommands.ts` registers command definitions with Discord (guild-scoped, instant)
- `app.config.ts` CDK stack (CDK entry, see `cdk.json`); Lambdas are bundled with the local esbuild
- `tests/` mirrors `src/`

### Commands

- `npm run build`, `npm test`, `npm run lint`, `npx cdk synth` are safe, run freely
- `npm run deploy` deploys to AWS; `npm run deploy:commands` pushes command definitions to Discord.
  Both are outward-facing, so ask before running. `deploy:commands` is only needed when a builder changes, not `execute`.

### Conventions

- Commit messages: no Claude attribution (no `Co-Authored-By: Claude` trailer or "Generated with Claude Code" line).
- Prettier: single quotes, semicolons, trailing commas. ESLint uses type-checked rules and must pass, tests included.
- Payload types come from `discord-api-types/v10`; use `type` imports.
- Env vars: add to `.env.dist`, pass via `environment` in `app.config.ts`, read as `process.env.X!` at module top.
- No top-level I/O in command modules: every command is bundled into the Interaction lambda too.
- Tests: jest + ts-jest. Mock modules by path (`jest.mock('../../src/...')`), cast with
  `as jest.MockedFunction<typeof fn>`, build interactions with a local `createInteraction()` cast `as unknown as <Type>`.
  Don't read mocked methods off objects (`jest/unbound-method`); route them through a `mockX` variable instead,
  as in `tests/execute.test.ts`.
