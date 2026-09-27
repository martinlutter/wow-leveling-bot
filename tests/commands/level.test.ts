import {
  type APIApplicationCommandInteractionDataOption,
  type APIChatInputApplicationCommandInteraction,
  type APIMessageApplicationCommandInteraction,
  ApplicationCommandOptionType,
  ApplicationCommandType,
} from 'discord-api-types/v10';
import autocompleteCharacters from '../../src/autocompleteCharacters';
import { levelCommand } from '../../src/commands/level';
import getCharacter from '../../src/db/getCharacter';
import getUserCharacters from '../../src/db/getUserCharacters';
import { type Character } from '../../src/db/model/character';
import recordLevel, { LevelDecreaseError } from '../../src/db/recordLevel';

jest.mock('../../src/db/getCharacter');
jest.mock('../../src/db/getUserCharacters');
jest.mock('../../src/db/recordLevel', () => ({
  __esModule: true,
  LevelDecreaseError: jest.requireActual<
    typeof import('../../src/db/recordLevel')
  >('../../src/db/recordLevel').LevelDecreaseError,
  default: jest.fn(),
}));
jest.mock('../../src/quotes', () => ({
  randomQuote: () => ({ text: 'Zug zug.', source: 'Orc peon' }),
}));

const mockGetCharacter = getCharacter as jest.MockedFunction<
  typeof getCharacter
>;
const mockGetUserCharacters = getUserCharacters as jest.MockedFunction<
  typeof getUserCharacters
>;
const mockRecordLevel = recordLevel as jest.MockedFunction<typeof recordLevel>;

const quoteLine = '> *Zug zug.* — Orc peon';
// <t:…:R> of the previous record's updatedAt
const since = '<t:1790406000:R>';

function createCharacter(name: string, level?: number): Character {
  return level === undefined
    ? { userId: 'user1', name }
    : {
        userId: 'user1',
        name,
        level,
        updatedAt: new Date('2026-09-26T07:00:00.000Z'),
      };
}

function createInteraction(
  level: number,
  character?: string,
  member: { nick?: string | null; globalName?: string | null } | null = {},
): APIChatInputApplicationCommandInteraction {
  const options: APIApplicationCommandInteractionDataOption[] = [
    { name: 'level', type: ApplicationCommandOptionType.Integer, value: level },
  ];
  if (character !== undefined) {
    options.push({
      name: 'character',
      type: ApplicationCommandOptionType.String,
      value: character,
    });
  }
  const user = {
    id: 'user1',
    username: 'thrall_fan',
    global_name: member?.globalName ?? null,
  };

  return {
    data: {
      name: 'level',
      type: ApplicationCommandType.ChatInput,
      options,
    },
    ...(member
      ? { member: { user, nick: member.nick ?? null } }
      : { user: { ...user, global_name: 'DM Name' } }),
  } as unknown as APIChatInputApplicationCommandInteraction;
}

describe('level command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCharacter.mockResolvedValue(undefined);
    mockGetUserCharacters.mockResolvedValue([]);
    mockRecordLevel.mockResolvedValue();
  });

  it('is registered as /level, autocompleting the character', () => {
    const json = levelCommand.builder.toJSON();

    expect(json.name).toBe('level');
    expect(
      json.options?.find((option) => option.name === 'character'),
    ).toMatchObject({ autocomplete: true });
    expect(levelCommand.autocomplete).toBe(autocompleteCharacters);
  });

  it('rejects a non chat input interaction', async () => {
    await expect(
      levelCommand.execute({
        data: { type: ApplicationCommandType.Message },
      } as unknown as APIMessageApplicationCommandInteraction),
    ).rejects.toThrow('Expected a chat input interaction');
  });

  it('throws when the level option is missing', async () => {
    const interaction = createInteraction(10);
    interaction.data.options = [];

    await expect(levelCommand.execute(interaction)).rejects.toThrow(
      'Missing the level option',
    );
  });

  describe('with a character name', () => {
    it('looks up the normalized name and keeps the stored casing', async () => {
      mockGetCharacter.mockResolvedValue(
        createCharacter('Grom Hellscream', 40),
      );

      const response = await levelCommand.execute(
        createInteraction(42, '  grom   HELLSCREAM '),
      );

      expect(mockGetCharacter).toHaveBeenCalledWith('user1', 'grom HELLSCREAM');
      expect(mockRecordLevel).toHaveBeenCalledWith({
        userId: 'user1',
        name: 'Grom Hellscream',
        level: 42,
        updatedAt: expect.any(Date) as Date,
      });
      expect(response).toEqual({
        public: true,
        content: `<@user1>'s **Grom Hellscream** reached level 42, ▲2 since ${since}.\n${quoteLine}`,
        allowed_mentions: { parse: [] },
      });
    });

    it('rejects a character that was never added', async () => {
      const response = await levelCommand.execute(
        createInteraction(3, 'Jaina'),
      );

      expect(mockRecordLevel).not.toHaveBeenCalled();
      expect(response).toEqual({
        content:
          'You have no character named **Jaina**. Add it with `/add-character`.',
      });
    });

    it('records the first level of an added character', async () => {
      mockGetCharacter.mockResolvedValue(createCharacter('Jaina'));

      const response = await levelCommand.execute(
        createInteraction(3, 'jaina'),
      );

      expect(mockRecordLevel).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Jaina', level: 3 }),
      );
      expect(response.content).toBe(
        `<@user1>'s **Jaina** starts at level 3.\n${quoteLine}`,
      );
    });
  });

  describe('without a character name', () => {
    it("creates a character named after the user's server nickname", async () => {
      const response = await levelCommand.execute(
        createInteraction(5, undefined, { nick: 'Nick', globalName: 'Global' }),
      );

      expect(mockGetUserCharacters).toHaveBeenCalledWith('user1');
      expect(mockRecordLevel).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user1', name: 'Nick', level: 5 }),
      );
      expect(response.content).toBe(
        `<@user1>'s **Nick** starts at level 5.\n${quoteLine}`,
      );
    });

    it('falls back to the display name', async () => {
      await levelCommand.execute(
        createInteraction(5, undefined, { globalName: 'Global  Name' }),
      );

      expect(mockRecordLevel).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Global Name' }),
      );
    });

    it('falls back to the username', async () => {
      await levelCommand.execute(createInteraction(5));

      expect(mockRecordLevel).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'thrall_fan' }),
      );
    });

    it('uses the user outside of a server', async () => {
      await levelCommand.execute(createInteraction(5, undefined, null));

      expect(mockGetUserCharacters).toHaveBeenCalledWith('user1');
      expect(mockRecordLevel).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user1', name: 'DM Name' }),
      );
    });

    it('escapes markdown in the name', async () => {
      const response = await levelCommand.execute(createInteraction(5));

      expect(response.content).toContain('**thrall\\_fan**');
    });

    it("uses the user's only character", async () => {
      mockGetUserCharacters.mockResolvedValue([createCharacter('Thrall', 12)]);

      const response = await levelCommand.execute(createInteraction(13));

      expect(mockGetCharacter).not.toHaveBeenCalled();
      expect(mockRecordLevel).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Thrall', level: 13 }),
      );
      expect(response.content).toBe(
        `<@user1>'s **Thrall** reached level 13, ▲1 since ${since}.\n${quoteLine}`,
      );
    });

    it("uses the user's only character even without a level", async () => {
      mockGetUserCharacters.mockResolvedValue([createCharacter('Thrall')]);

      const response = await levelCommand.execute(createInteraction(13));

      expect(response.content).toBe(
        `<@user1>'s **Thrall** starts at level 13.\n${quoteLine}`,
      );
    });

    it('asks which character when the user has more than one', async () => {
      mockGetUserCharacters.mockResolvedValue([
        createCharacter('Grom', 40),
        createCharacter('Thrall'),
      ]);

      const response = await levelCommand.execute(createInteraction(13));

      expect(mockRecordLevel).not.toHaveBeenCalled();
      expect(response).toEqual({
        content:
          'You have more than one character: **Grom** (level 40), **Thrall** (no level yet). Pick one with the `character` option.',
      });
    });
  });

  it('accepts the same level and says nothing changed', async () => {
    mockGetUserCharacters.mockResolvedValue([createCharacter('Thrall', 12)]);

    const response = await levelCommand.execute(createInteraction(12));

    expect(mockRecordLevel).toHaveBeenCalled();
    expect(response.content).toBe(
      `<@user1>'s **Thrall** is still level 12, no change since ${since}.\n${quoteLine}`,
    );
  });

  it('rejects a lower level privately', async () => {
    mockGetUserCharacters.mockResolvedValue([createCharacter('Thrall', 12)]);
    mockRecordLevel.mockRejectedValue(new LevelDecreaseError());

    const response = await levelCommand.execute(createInteraction(10));

    expect(response).toEqual({
      content: "**Thrall** is already above level 10. Levels can't go down.",
    });
  });

  it('rethrows other storage errors', async () => {
    const error = new Error('boom');
    mockRecordLevel.mockRejectedValue(error);

    await expect(levelCommand.execute(createInteraction(10))).rejects.toBe(
      error,
    );
  });

  it('celebrates reaching the max level', async () => {
    mockGetUserCharacters.mockResolvedValue([createCharacter('Thrall', 59)]);

    const response = await levelCommand.execute(createInteraction(60));

    expect(response.content).toBe(
      `🎉 <@user1>'s **Thrall** reached level 60, ▲1 since ${since}. Max level!\n${quoteLine}`,
    );
  });

  it('celebrates a new character starting at the max level', async () => {
    const response = await levelCommand.execute(createInteraction(60));

    expect(response.content).toMatch(/^🎉 .* starts at level 60\. Max level!/);
  });

  it("doesn't celebrate again when refreshing the max level", async () => {
    mockGetUserCharacters.mockResolvedValue([createCharacter('Thrall', 60)]);

    const response = await levelCommand.execute(createInteraction(60));

    expect(response.content).not.toContain('🎉');
  });
});
