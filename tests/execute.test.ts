import { handler } from '../src/execute';
import type {
  APIChatInputApplicationCommandInteraction,
  APIMessageComponentButtonInteraction,
} from 'discord-api-types/v10';
import {
  InteractionType,
  ApplicationCommandType,
  ComponentType,
} from 'discord-api-types/v10';

const mockFollowUp = jest.fn();
const mockEditReply = jest.fn();
const mockDeleteReply = jest.fn();
const mockCreateMessage = jest.fn();
jest.mock('../src/clients/discordApi', () => ({
  discordApi: {
    interactions: {
      followUp: (...args: unknown[]): unknown => mockFollowUp(...args),
      editReply: (...args: unknown[]): unknown => mockEditReply(...args),
      deleteReply: (...args: unknown[]): unknown => mockDeleteReply(...args),
    },
    channels: {
      createMessage: (...args: unknown[]): unknown =>
        mockCreateMessage(...args),
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
jest.mock('../src/commands/removeCharacter', () => ({
  removeCharacterCommand: {
    builder: { name: 'remove-character' },
    execute: jest.fn(),
    handleButton: jest.fn(),
  },
}));

// Import after mocking
import { pingCommand } from '../src/commands/ping';
import { removeCharacterCommand } from '../src/commands/removeCharacter';

const mockPingExecute = pingCommand.execute as jest.Mock;
const mockHandleButton = removeCharacterCommand.handleButton as jest.Mock;

function createInteraction(
  commandName: string,
): APIChatInputApplicationCommandInteraction {
  return {
    type: InteractionType.ApplicationCommand,
    id: 'interaction1',
    application_id: 'app1',
    token: 'token1',
    version: 1,
    channel: { id: 'channel1' },
    data: {
      id: 'cmd1',
      name: commandName,
      type: ApplicationCommandType.ChatInput,
    },
  } as unknown as APIChatInputApplicationCommandInteraction;
}

function createButtonInteraction(
  customId: string,
): APIMessageComponentButtonInteraction {
  return {
    type: InteractionType.MessageComponent,
    application_id: 'app1',
    token: 'token1',
    data: { custom_id: customId, component_type: ComponentType.Button },
  } as unknown as APIMessageComponentButtonInteraction;
}

describe('execute handler', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFollowUp.mockResolvedValue({});
    mockEditReply.mockResolvedValue({});
    mockDeleteReply.mockResolvedValue(undefined);
    mockCreateMessage.mockResolvedValue({});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('executes the matching command and sends followUp', async () => {
    const responseData = { content: 'Pong!' };
    mockPingExecute.mockResolvedValue(responseData);

    const interaction = createInteraction('ping');
    await handler(interaction);

    expect(mockPingExecute).toHaveBeenCalledWith(interaction);
    expect(mockFollowUp).toHaveBeenCalledWith('app1', 'token1', responseData);
    expect(mockCreateMessage).not.toHaveBeenCalled();
    expect(mockDeleteReply).not.toHaveBeenCalled();
  });

  it('posts a public result to the channel and deletes the ephemeral reply', async () => {
    mockPingExecute.mockResolvedValue({ content: 'Pong!', public: true });

    await handler(createInteraction('ping'));

    expect(mockCreateMessage).toHaveBeenCalledWith('channel1', {
      content: 'Pong!',
    });
    expect(mockDeleteReply).toHaveBeenCalledWith('app1', 'token1');
    expect(mockCreateMessage.mock.invocationCallOrder[0]).toBeLessThan(
      mockDeleteReply.mock.invocationCallOrder[0],
    );
    expect(mockFollowUp).not.toHaveBeenCalled();
    expect(mockEditReply).not.toHaveBeenCalled();
  });

  it('falls back to a public follow-up when posting to the channel fails', async () => {
    mockPingExecute.mockResolvedValue({ content: 'Pong!', public: true });
    mockCreateMessage.mockRejectedValue(new Error('Missing Permissions'));

    await handler(createInteraction('ping'));

    expect(consoleError).toHaveBeenCalled();
    expect(mockEditReply).toHaveBeenCalledWith('app1', 'token1', {
      content: 'Posting…',
    });
    expect(mockFollowUp).toHaveBeenCalledWith('app1', 'token1', {
      content: 'Pong!',
    });
    expect(mockDeleteReply).toHaveBeenCalledWith('app1', 'token1');
    const [editOrder] = mockEditReply.mock.invocationCallOrder;
    const [followUpOrder] = mockFollowUp.mock.invocationCallOrder;
    const [deleteOrder] = mockDeleteReply.mock.invocationCallOrder;
    expect(editOrder).toBeLessThan(followUpOrder);
    expect(followUpOrder).toBeLessThan(deleteOrder);
  });

  it('sends a fallback followUp when the command throws', async () => {
    mockPingExecute.mockRejectedValue(new Error('boom'));

    await handler(createInteraction('ping'));

    expect(consoleError).toHaveBeenCalled();
    expect(mockFollowUp).toHaveBeenCalledWith('app1', 'token1', {
      content: 'Something went wrong, please try again later.',
    });
  });

  describe('buttons', () => {
    it("routes a click to the command's button handler and edits the message", async () => {
      const response = { content: 'Removed **Grom**.', components: [] };
      mockHandleButton.mockResolvedValue(response);
      const interaction = createButtonInteraction('remove-character:yes:Grom');

      await handler(interaction);

      expect(mockHandleButton).toHaveBeenCalledWith(interaction);
      expect(mockEditReply).toHaveBeenCalledWith('app1', 'token1', response);
      expect(mockFollowUp).not.toHaveBeenCalled();
    });

    it('edits the message with a generic error when the handler throws', async () => {
      mockHandleButton.mockRejectedValue(new Error('boom'));

      await handler(createButtonInteraction('remove-character:yes:Grom'));

      expect(consoleError).toHaveBeenCalled();
      expect(mockEditReply).toHaveBeenCalledWith('app1', 'token1', {
        content: 'Something went wrong, please try again later.',
      });
    });
  });
});
