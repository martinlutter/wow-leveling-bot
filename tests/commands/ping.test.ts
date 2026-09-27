import { pingCommand } from '../../src/commands/ping';
import type { APIChatInputApplicationCommandInteraction } from 'discord-api-types/v10';

describe('ping command', () => {
  it('is registered as /ping', () => {
    expect(pingCommand.builder.name).toBe('ping');
  });

  it('replies with Pong!', async () => {
    const response = await pingCommand.execute(
      {} as APIChatInputApplicationCommandInteraction,
    );

    expect(response).toEqual({ content: 'Pong!' });
  });
});
