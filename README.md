# WoW Leveling Recorder Bot

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A Discord bot for recording World of Warcraft leveling progress. It runs entirely on AWS Lambda.
There is no open websocket (gateway) connection: Discord sends every interaction to an HTTPS webhook
(API Gateway), and the bot answers through Discord's REST API. Infrastructure is defined with AWS CDK.

## How it works

```
Discord ──POST──▶ API Gateway ──▶ Interaction lambda (src/index.ts)
                                   │ 1. verify signature
                                   │ 2. PING → PONG
                                   │ 3. command or button click → async invoke
                                   │    Execute lambda, reply "deferred"
                                   ▼
                                  Execute lambda (src/execute.ts)
                                   │ run the command
                                   └──▶ Discord REST API: follow-up message
```

Discord requires an answer within 3 seconds, so the Interaction lambda only validates the request and defers.
The actual work happens in the Execute lambda, which has up to 15 minutes to send a follow-up
(it has a 10 second timeout by default).

A third lambda posts the daily report. EventBridge Scheduler triggers it every day at 07:00 Central European time.

## Commands

- `/add-character <name>`: add a character to record levels for. Names have 1 or 2 words (`Grom Hellscream`), are
  case-insensitive, and keep the casing you typed. The character has no level until its first `/level`.
- `/level <level> [character]`: record the level (1–60) your character reached. Posts publicly in the channel with the
  change since the previous record and a random WoW quote. 🎉 on reaching 60.
  - `character` must be one of your characters, and is needed once you have more than one. It autocompletes your
    characters.
  - Without `character` and with no characters yet, one is created named after you (server nickname, then display name,
    then username).
  - Levels can't go down. Recording the same level again refreshes "last updated".
- `/progress [user] [character]`: show a player's progress, yours by default. Posts publicly. For each character (or
  just `character`): current level, first record and levels gained since, pace and ETA to 60, and when it was last
  updated. `character` autocompletes the characters of `user`, or yours.
  - Pace is levels per day from the first record to the latest one. It needs records at least a day apart.
  - The ETA assumes a steady pace, so it's optimistic: late levels take longer.
- `/remove-character <name>`: remove a character and its level history, after a Yes/No confirmation. `name`
  autocompletes your characters.
- `/ping`: check that the bot is alive.

Everything except a successful `/level` or `/progress` (errors, confirmations) is only visible to you.

### Daily report

Every day at 07:00 Central European time (following daylight saving time), the bot posts to the `REPORT_CHANNEL_ID`
channel. It lists every character by level with its change over the last 24 hours (▲ gained, — none, 🆕 no record older
than 24 hours), its pace (once its records are a day apart) and when it was last updated. 💤 marks a character below 60
without an update for more than 3 days.

## Project structure

```
app.config.ts              CDK stack: 3 lambdas, REST API, DynamoDB table, daily schedule
scripts/deployCommands.ts  registers the commands with Discord
src/index.ts               Interaction lambda + the list of commands
src/execute.ts             Execute lambda
src/dailyReport.ts         Daily report lambda
src/clients/               Discord REST and DynamoDB clients
src/commands/              one file per command
src/db/                    data access (one function per access pattern) and models
src/leveling.ts            pace, ETA and stale rules shared by /progress and the report
src/quotes.ts              WoW quotes for /level replies
tests/                     jest tests, mirrors src/
.claude/                   Claude Code settings and skills
```

## Setup

### 1. Prerequisites

- Node.js 24
- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) and an AWS account
- A Discord account and a server where you have the **Manage Server** permission

```bash
git clone <this-repo> wow-leveling-recorder-bot
cd wow-leveling-recorder-bot
npm install
```

### 2. Create the Discord application

1. Open the [Discord Developer Portal](https://discord.com/developers/applications) and click **New Application**.
2. **General Information** tab: copy the **Application ID** and the **Public Key**.
3. **Bot** tab: click **Reset Token** and copy the token. It's only shown once.
   - No privileged gateway intents are needed; this bot never connects to the gateway.
   - Optional: turn off **Public Bot** so only you can add it to servers. You first have to set the Install Link
     (Installation tab) to **None**, otherwise Discord refuses to save.
4. Get your server's ID: in Discord go to **User Settings → Advanced** and turn on **Developer Mode**,
   then right-click the server icon and choose **Copy Server ID**.

### 3. Set the environment variables

```bash
cp .env.dist .env
```

```
DISCORD_TOKEN=           # Bot tab → token
APPLICATION_PUBLIC_KEY=  # General Information → Public Key
APPLICATION_CLIENT_ID=   # General Information → Application ID
GUILD_ID=                # server ID from step 2.4
REPORT_CHANNEL_ID=       # channel for the daily report: right-click it → Copy Channel ID (Developer Mode on)
```

`.env` is read by `app.config.ts` at deploy time (the values become Lambda environment variables) and by
`scripts/deployCommands.ts`. It's gitignored, so never commit it.

### 4. Add the bot to your server

Build an invite URL and open it in a browser:

```
https://discord.com/oauth2/authorize?client_id=<APPLICATION_CLIENT_ID>&scope=bot+applications.commands&permissions=18432
```

- `applications.commands` lets the app register slash commands in the server.
- `bot` adds a bot user, which is needed for anything outside of replying to a command
  (posting to a channel on a schedule, reading messages, …).
- `permissions` is a bitfield of what the bot user can do. `18432` is Send Messages (2048) + Embed Links (16384). The
  daily report needs them in the `REPORT_CHANNEL_ID` channel, and public `/level` and `/progress` replies need Send
  Messages in every channel they're used in. For a private channel, also give the bot's role access to it. To choose others,
  use **OAuth2 → URL Generator** in the portal: tick `bot` + `applications.commands`, tick the permissions,
  and copy the generated URL.

Private replies to commands work without any permissions: they go through the interaction token.

### 5. Register the commands

```bash
npm run deploy:commands
```

This registers the commands for the server in `GUILD_ID` only. Server commands update instantly, so they're
ideal while developing. Re-run it whenever you add a command or change a command's name, description or options.
Changes that only touch `execute` don't need it.

To make the commands available in every server the bot joins, change `Routes.applicationGuildCommands(clientId, guildId)`
to `Routes.applicationCommands(clientId)` in `scripts/deployCommands.ts`. Global commands can take a while to show up.

### 6. Deploy to AWS

Create an AWS profile with the name used in `package.json` (a region is required):

```bash
aws configure --profile wow-leveling-recorder-bot
```

Bootstrap CDK once per account and region, then deploy:

```bash
npx cdk bootstrap --profile wow-leveling-recorder-bot
npm run deploy
```

At the end the deploy prints an output like:

```
WowLevelingRecorderBot.InteractionsEndpointUrl = https://abc123.execute-api.eu-central-1.amazonaws.com/prod/
```

The Lambdas are bundled with the locally installed esbuild. Docker isn't needed.

### 7. Point Discord at the endpoint

Paste the `InteractionsEndpointUrl` into **General Information → Interactions Endpoint URL** in the Developer Portal
and save. Discord immediately sends a signed PING to that URL and only saves it if the bot answers correctly. If saving
fails, check that `APPLICATION_PUBLIC_KEY` is right and redeploy.

### 8. Try it

Type `/ping` in your server. The bot should answer **Pong!** (visible only to you). Then `/level 1` should post a public
reply.

## Development

```bash
npm run build    # type-check and compile into dist/
npm test         # jest
npm run lint     # eslint
npx cdk synth    # check the CDK stack without deploying
```

### Adding a command

1. Create `src/commands/<name>.ts` that exports a `Command` (`{ builder, execute }`); see `src/commands/ping.ts`.
2. Add it to the `commands` array in `src/index.ts`.
3. Add a test in `tests/commands/`.
4. `npm run deploy:commands` to register it, then `npm run deploy` to ship the code.

With Claude Code, ask it to add the command; the `add-command` skill covers these steps.

### Replies

The Interaction lambda defers with the `Ephemeral` flag, so by default the reply is only visible to the user who ran the
command. A command can return `public: true` to post for everyone instead: `execute.ts` then posts the result to the
channel as a plain message and deletes the ephemeral reply. So a command can answer errors privately and successes
publicly. Posting needs Send Messages in the channel; without it, `execute.ts` logs the error and falls back to a public
follow-up, which Discord shows as a reply to the deleted ephemeral message. If a command throws, `execute.ts` logs the
error and sends a generic "Something went wrong" reply.

### Buttons

A command can add buttons to its reply and handle clicks with `handleButton`. A button's `custom_id` must start with
`<command name>:`, which is how the Interaction lambda finds the command. The click is deferred, and `execute.ts` replaces
the message holding the button with `handleButton`'s result. See `src/commands/removeCharacter.ts`.

### Storage

One DynamoDB table (single-table design, `pk`/`sk` keys). It's kept when the stack is deleted (`RemovalPolicy.RETAIN`).
Characters live in one partition (`pk = CHARACTERS`), the level history in one partition per character
(`pk = RECORD#<userId>#<lowercase name>`, `sk` = ISO timestamp).

### Logs

Each Lambda has its own CloudWatch log group with 1 month retention (see `app.config.ts`).

## License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT).
