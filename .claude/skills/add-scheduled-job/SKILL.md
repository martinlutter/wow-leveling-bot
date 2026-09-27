---
name: add-scheduled-job
description: Add a Lambda that runs on a schedule (cron/rate), e.g. a daily reminder or a monthly summary posted to a channel. Use when the bot must act without a user interaction.
---

# Add a scheduled job

1. Create `src/<camelName>.ts`:

   ```ts
   import { discordApi } from './clients/discordApi';

   const channelId = process.env.CHANNEL_ID!;

   export const handler = async (): Promise<void> => {
     await discordApi.channels.createMessage(channelId, { content: '...' });
   };
   ```

   Posting to a channel needs the bot user in the server (`bot` scope) with Send Messages in that channel.

2. In `app.config.ts` (imports: `Rule`, `Schedule` from `aws-cdk-lib/aws-events`, `LambdaFunction` from
   `aws-cdk-lib/aws-events-targets`):

   ```ts
   const <camelName>Lambda = new NodejsFunction(stack, '<PascalName>', {
     runtime: Runtime.NODEJS_22_X,
     entry: 'src/<camelName>.ts',
     bundling: {
       minify: true,
     },
     environment: {
       CHANNEL_ID: process.env.CHANNEL_ID!,
       ...commonEnvVars,
     },
     logGroup: new LogGroup(stack, '<PascalName>Logs', {
       retention: RetentionDays.ONE_MONTH,
     }),
     timeout: Duration.seconds(10),
     memorySize: 256,
   });

   new Rule(stack, '<PascalName>Schedule', {
     schedule: Schedule.cron({ minute: '0', hour: '9' }), // UTC
   }).addTarget(new LambdaFunction(<camelName>Lambda));
   ```

3. Add new env vars to `.env.dist` and tell the user to fill them in `.env`. A channel ID is copied with
   right-click → Copy Channel ID (Developer Mode on).
4. Add `tests/<camelName>.test.ts` with `discordApi` mocked (see `tests/execute.test.ts` for the pattern).
5. Run `npm run build && npm test && npm run lint && npx cdk synth`, then tell the user to `npm run deploy`.

## Gotchas

- EventBridge cron is always UTC. Unset `Schedule.cron` fields default to `*`; `day` and `weekDay` can't both be set.
  `Schedule.rate(Duration.hours(1))` is simpler for fixed intervals.
- If the job reads data with a DynamoDB TTL, schedule it before the data expires. TTL deletion can lag by up to ~48h,
  so don't rely on TTL for correctness either: filter expired items in queries.
- EventBridge retries a failed async invocation, so make the handler safe to run twice (e.g. don't double-post).
