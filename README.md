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
                                   │ 3. command → async invoke Execute lambda,
                                   │    reply "deferred" (bot is thinking…)
                                   ▼
                                  Execute lambda (src/execute.ts)
                                   │ run the command
                                   └──▶ Discord REST API: follow-up message
```

Discord requires an answer within 3 seconds, so the Interaction lambda only validates the request and defers.
The actual work happens in the Execute lambda, which has up to 15 minutes to send a follow-up
(it has a 10 second timeout by default).

## Project structure

```
app.config.ts              CDK stack: 2 lambdas + REST API
scripts/deployCommands.ts  registers the commands with Discord
src/index.ts               Interaction lambda + the list of commands
src/execute.ts             Execute lambda
src/clients/discordApi.ts  Discord REST client
src/commands/ping.ts       example command
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
```

`.env` is read by `app.config.ts` at deploy time (the values become Lambda environment variables) and by
`scripts/deployCommands.ts`. It's gitignored, so never commit it.

### 4. Add the bot to your server

Build an invite URL and open it in a browser:

```
https://discord.com/oauth2/authorize?client_id=<APPLICATION_CLIENT_ID>&scope=bot+applications.commands&permissions=2048
```

- `applications.commands` lets the app register slash commands in the server.
- `bot` adds a bot user, which is needed for anything outside of replying to a command
  (posting to a channel on a schedule, reading messages, …).
- `permissions` is a bitfield of what the bot user can do. `2048` is Send Messages. To choose others,
  use **OAuth2 → URL Generator** in the portal: tick `bot` + `applications.commands`, tick the permissions,
  and copy the generated URL.

Replying to commands works without any permissions: the replies go through the interaction token.

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

Type `/ping` in your server. The bot should answer **Pong!** (visible only to you).

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

The Interaction lambda defers with the `Ephemeral` flag, so the follow-up is only visible to the user who ran the command.
Remove `flags: MessageFlags.Ephemeral` in `src/index.ts` to make replies public.
If a command throws, `execute.ts` logs the error and sends a generic "Something went wrong" reply.

### Logs

Each Lambda has its own CloudWatch log group with 1 month retention (see `app.config.ts`).

## License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT).
