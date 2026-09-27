import { handler } from '../src/index';
import { InteractionResponseType, verifyKey } from 'discord-interactions';
import { InteractionType, MessageFlags } from 'discord-api-types/v10';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import autocompleteCharacters from '../src/autocompleteCharacters';

jest.mock('discord-interactions', () => ({
  verifyKey: jest.fn(),
  InteractionResponseType: {
    PONG: 1,
    DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
    DEFERRED_UPDATE_MESSAGE: 6,
    APPLICATION_COMMAND_AUTOCOMPLETE_RESULT: 8,
  },
}));

jest.mock('@aws-sdk/client-lambda', () => {
  const mockSend = jest.fn().mockResolvedValue({});
  return {
    LambdaClient: jest.fn(() => ({ send: mockSend })),
    InvokeCommand: jest.fn(),
    InvocationType: { Event: 'Event' },
  };
});

jest.mock('../src/autocompleteCharacters');

const mockVerifyKey = verifyKey as jest.MockedFunction<typeof verifyKey>;
const mockAutocompleteCharacters =
  autocompleteCharacters as jest.MockedFunction<typeof autocompleteCharacters>;

type ResponseBody = {
  message?: string;
  type?: number;
  data?: { flags?: number; choices?: unknown[] };
};

function parseBody(body: string): ResponseBody {
  return JSON.parse(body) as ResponseBody;
}

function createEvent(
  body: object,
  headers: Record<string, string> = {},
): APIGatewayProxyEvent {
  return {
    body: JSON.stringify(body),
    headers: {
      'x-signature-ed25519': 'sig123',
      'x-signature-timestamp': 'ts123',
      ...headers,
    },
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as APIGatewayProxyEvent['requestContext'],
    resource: '',
    multiValueHeaders: {},
  };
}

describe('index handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 for invalid signature', async () => {
    mockVerifyKey.mockResolvedValue(false);

    const result = await handler(createEvent({ type: InteractionType.Ping }));

    expect(result.statusCode).toBe(401);
    expect(parseBody(result.body).message).toBe('Invalid request signature');
  });

  it('responds with PONG for ping interactions', async () => {
    mockVerifyKey.mockResolvedValue(true);

    const result = await handler(createEvent({ type: InteractionType.Ping }));

    expect(result.statusCode).toBe(200);
    expect(parseBody(result.body).type).toBe(InteractionResponseType.PONG);
  });

  it('returns deferred response for valid application commands', async () => {
    mockVerifyKey.mockResolvedValue(true);

    const result = await handler(
      createEvent({
        type: InteractionType.ApplicationCommand,
        data: { name: 'ping' },
      }),
    );

    expect(result.statusCode).toBe(200);
    const body = parseBody(result.body);
    expect(body.type).toBe(
      InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    );
    expect(body.data?.flags).toBe(MessageFlags.Ephemeral);
  });

  it('returns 400 for unknown command', async () => {
    mockVerifyKey.mockResolvedValue(true);

    const result = await handler(
      createEvent({
        type: InteractionType.ApplicationCommand,
        data: { name: 'nonexistent' },
      }),
    );

    expect(result.statusCode).toBe(400);
    expect(parseBody(result.body).message).toBe('Command not found');
  });

  it("answers autocomplete with the command's choices", async () => {
    mockVerifyKey.mockResolvedValue(true);
    const choices = [{ name: 'Grom · level 42', value: 'Grom' }];
    mockAutocompleteCharacters.mockResolvedValue(choices);
    const interaction = {
      type: InteractionType.ApplicationCommandAutocomplete,
      data: { name: 'level', options: [] },
    };

    const result = await handler(createEvent(interaction));

    expect(mockAutocompleteCharacters).toHaveBeenCalledWith(interaction);
    expect(result.statusCode).toBe(200);
    expect(parseBody(result.body)).toEqual({
      type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
      data: { choices },
    });
  });

  it.each(['ping', 'unknown'])(
    'answers autocomplete for %s, which has none, with no choices',
    async (name) => {
      mockVerifyKey.mockResolvedValue(true);

      const result = await handler(
        createEvent({
          type: InteractionType.ApplicationCommandAutocomplete,
          data: { name, options: [] },
        }),
      );

      expect(parseBody(result.body).data).toEqual({ choices: [] });
    },
  );

  it('answers autocomplete with no choices when it fails', async () => {
    mockVerifyKey.mockResolvedValue(true);
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    mockAutocompleteCharacters.mockRejectedValue(new Error('boom'));

    const result = await handler(
      createEvent({
        type: InteractionType.ApplicationCommandAutocomplete,
        data: { name: 'level', options: [] },
      }),
    );

    expect(consoleError).toHaveBeenCalled();
    expect(result.statusCode).toBe(200);
    expect(parseBody(result.body).data).toEqual({ choices: [] });
    consoleError.mockRestore();
  });

  it('defers a message update for a button of a known command', async () => {
    mockVerifyKey.mockResolvedValue(true);

    const result = await handler(
      createEvent({
        type: InteractionType.MessageComponent,
        data: { custom_id: 'remove-character:yes:Grom' },
      }),
    );

    expect(result.statusCode).toBe(200);
    expect(parseBody(result.body).type).toBe(
      InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
    );
  });

  it.each(['unknown:yes:Grom', 'ping:yes'])(
    'returns 400 for button %s without a handler',
    async (customId) => {
      mockVerifyKey.mockResolvedValue(true);

      const result = await handler(
        createEvent({
          type: InteractionType.MessageComponent,
          data: { custom_id: customId },
        }),
      );

      expect(result.statusCode).toBe(400);
      expect(parseBody(result.body).message).toBe('Button not found');
    },
  );

  it('returns 400 for unsupported interaction type', async () => {
    mockVerifyKey.mockResolvedValue(true);

    const result = await handler(createEvent({ type: 99 }));

    expect(result.statusCode).toBe(400);
    expect(parseBody(result.body).message).toBe('Not supported');
  });

  it('normalizes header keys to lowercase', async () => {
    mockVerifyKey.mockResolvedValue(true);

    const event = createEvent(
      { type: InteractionType.Ping },
      {
        'X-Signature-Ed25519': 'sig123',
        'X-Signature-Timestamp': 'ts123',
      },
    );
    // Remove lowercase headers set by createEvent
    delete event.headers['x-signature-ed25519'];
    delete event.headers['x-signature-timestamp'];

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
  });
});
