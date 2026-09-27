import {
  type APIChatInputApplicationCommandInteraction,
  type APIMessageApplicationCommandInteraction,
  ApplicationCommandOptionType,
  ApplicationCommandType,
} from 'discord-api-types/v10';
import { addCharacterCommand } from '../../src/commands/addCharacter';
import addCharacter, { CharacterExistsError } from '../../src/db/addCharacter';

jest.mock('../../src/db/addCharacter', () => ({
  __esModule: true,
  CharacterExistsError: jest.requireActual<
    typeof import('../../src/db/addCharacter')
  >('../../src/db/addCharacter').CharacterExistsError,
  default: jest.fn(),
}));

const mockAddCharacter = addCharacter as jest.MockedFunction<
  typeof addCharacter
>;

function createInteraction(
  name?: string,
): APIChatInputApplicationCommandInteraction {
  return {
    data: {
      name: 'add-character',
      type: ApplicationCommandType.ChatInput,
      options:
        name === undefined
          ? []
          : [
              {
                name: 'name',
                type: ApplicationCommandOptionType.String,
                value: name,
              },
            ],
    },
    member: { user: { id: 'user1', username: 'thrall_fan' } },
  } as unknown as APIChatInputApplicationCommandInteraction;
}

describe('add-character command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAddCharacter.mockResolvedValue();
  });

  it('is registered as /add-character', () => {
    expect(addCharacterCommand.builder.name).toBe('add-character');
  });

  it('rejects a non chat input interaction', async () => {
    await expect(
      addCharacterCommand.execute({
        data: { type: ApplicationCommandType.Message },
      } as unknown as APIMessageApplicationCommandInteraction),
    ).rejects.toThrow('Expected a chat input interaction');
  });

  it('throws when the name option is missing', async () => {
    await expect(
      addCharacterCommand.execute(createInteraction()),
    ).rejects.toThrow('Missing the name option');
  });

  it('adds the normalized name privately', async () => {
    const response = await addCharacterCommand.execute(
      createInteraction('  Grom   Hellscream '),
    );

    expect(mockAddCharacter).toHaveBeenCalledWith('user1', 'Grom Hellscream');
    expect(response).toEqual({
      content: 'Added **Grom Hellscream**. Record its level with `/level`.',
    });
  });

  it.each(['Grom Hell scream', '   '])(
    'rejects "%s" without adding it',
    async (name) => {
      const response = await addCharacterCommand.execute(
        createInteraction(name),
      );

      expect(mockAddCharacter).not.toHaveBeenCalled();
      expect(response).toEqual({
        content:
          'A character name has one or two words, like `Grom Hellscream`.',
      });
    },
  );

  it('says so when the user already has the character', async () => {
    mockAddCharacter.mockRejectedValue(new CharacterExistsError());

    const response = await addCharacterCommand.execute(
      createInteraction('Grom'),
    );

    expect(response).toEqual({ content: 'You already have **Grom**.' });
  });

  it('rethrows other storage errors', async () => {
    const error = new Error('boom');
    mockAddCharacter.mockRejectedValue(error);

    await expect(
      addCharacterCommand.execute(createInteraction('Grom')),
    ).rejects.toBe(error);
  });
});
