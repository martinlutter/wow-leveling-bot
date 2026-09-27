import { handler } from '../src/execute';
import type { APIChatInputApplicationCommandInteraction } from 'discord-api-types/v10';
import { InteractionType, ApplicationCommandType } from 'discord-api-types/v10';

const mockFollowUp = jest.fn();
jest.mock('../src/clients/discordApi', () => ({
  discordApi: {
    interactions: {
      followUp: (...args: unknown[]): unknown => mockFollowUp(...args),
    },
  },
}));

// Mock the command modules before importing
jest.mock('../src/commands/ping', () => ({
  pingCommand: {
    builder: { name: 'ping' },
    execute: jest.fn(),
  },
}));

// Import after mocking
import { pingCommand } from '../src/commands/ping';

const mockPingExecute = pingCommand.execute as jest.Mock;

function createInteraction(
  commandName: string,
): APIChatInputApplicationCommandInteraction {
  return {
    type: InteractionType.ApplicationCommand,
    id: 'interaction1',
    application_id: 'app1',
    token: 'token1',
    version: 1,
    data: {
      id: 'cmd1',
      name: commandName,
      type: ApplicationCommandType.ChatInput,
    },
  } as unknown as APIChatInputApplicationCommandInteraction;
}

describe('execute handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFollowUp.mockResolvedValue({});
  });

  it('executes the matching command and sends followUp', async () => {
    const responseData = { content: 'Pong!' };
    mockPingExecute.mockResolvedValue(responseData);

    const interaction = createInteraction('ping');
    await handler(interaction);

    expect(mockPingExecute).toHaveBeenCalledWith(interaction);
    expect(mockFollowUp).toHaveBeenCalledWith('app1', 'token1', responseData);
  });

  it('sends a fallback followUp when the command throws', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    mockPingExecute.mockRejectedValue(new Error('boom'));

    await handler(createInteraction('ping'));

    expect(consoleError).toHaveBeenCalled();
    expect(mockFollowUp).toHaveBeenCalledWith('app1', 'token1', {
      content: 'Something went wrong, please try again later.',
    });
    consoleError.mockRestore();
  });
});
