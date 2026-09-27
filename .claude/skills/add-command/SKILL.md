---
name: add-command
description: Add a Discord slash command, message context-menu command, or user context-menu command to this bot. Use when asked to add/create a command, e.g. "add a /roll command" or "add a right-click action on messages".
---

# Add a command

1. Pick the builder and type guard:

   | Kind         | Builder                                                                   | Guard (`discord-api-types/utils`)            |
   | ------------ | ------------------------------------------------------------------------- | -------------------------------------------- |
   | Slash        | `new SlashCommandBuilder()`                                               | `isChatInputApplicationCommandInteraction`   |
   | Message menu | `new ContextMenuCommandBuilder().setType(ApplicationCommandType.Message)` | `isContextMenuApplicationCommandInteraction` |
   | User menu    | `new ContextMenuCommandBuilder().setType(ApplicationCommandType.User)`    | `isContextMenuApplicationCommandInteraction` |

2. Create `src/commands/<camelName>.ts`:

   ```ts
   import { SlashCommandBuilder } from '@discordjs/builders';
   import { isChatInputApplicationCommandInteraction } from 'discord-api-types/utils';
   import {
     type APIChatInputApplicationCommandInteraction,
     type APIInteractionResponseCallbackData,
     type APIMessageApplicationCommandInteraction,
   } from 'discord-api-types/v10';
   import { type Command } from '..';

   const builder = new SlashCommandBuilder()
     .setName('<name>')
     .setDescription('<description>');

   const execute = async (
     interaction:
       | APIChatInputApplicationCommandInteraction
       | APIMessageApplicationCommandInteraction,
   ): Promise<APIInteractionResponseCallbackData> => {
     if (!isChatInputApplicationCommandInteraction(interaction)) {
       throw new Error('Expected a chat input interaction');
     }
     // options: interaction.data.options?.find((option) => option.name === '...')
     // resolved users/messages: interaction.data.resolved
     return { content: '...' };
   };

   export const <camelName>Command: Command = { builder, execute };
   ```

   For a user context-menu command, add `APIUserApplicationCommandInteraction` to the `execute` union of the
   `Command` interface in `src/index.ts`.

3. Add it to the `commands` array in `src/index.ts`.
4. Add `tests/commands/<camelName>.test.ts`: mock every module the command imports, cover the happy path and each early
   return. Build the interaction with a local `createInteraction()` factory cast `as unknown as <Type>`.
5. Run `npm run build && npm test && npm run lint`.
6. Tell the user to run `npm run deploy:commands` (registers the definition with Discord) and `npm run deploy`
   (ships the code). Don't run them yourself.

## Gotchas

- Slash command names: lowercase, 1–32 chars, no spaces. Context-menu names may have spaces and capitals.
- The reply is a follow-up to an ephemeral deferred response, so only the caller sees it. To post publicly, use
  `discordApi.channels.createMessage` (the bot user must be in the server with Send Messages).
- For expected failures (bad input, nothing found) return `{ content: '...' }`. Throwing is for bugs: `execute.ts`
  catches it, logs it, and replies with a generic error.
- `execute` runs in the Execute lambda (10s timeout, raise it in `app.config.ts` if needed). Don't do I/O at module top
  level: every command is also bundled into the Interaction lambda, which must answer within 3s.
- Discord limits: content 2000 chars, 10 embeds per message, 25 fields per embed, 1024 chars per field value.
- Reading messages or channels with `discordApi` needs the matching bot permissions in the invite URL.
