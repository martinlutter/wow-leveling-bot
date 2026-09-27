import {
  type APIChatInputApplicationCommandInteraction,
  type APIMessageApplicationCommandInteraction,
  type APIMessageComponentButtonInteraction,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ButtonStyle,
  ComponentType,
} from 'discord-api-types/v10';
import autocompleteCharacters from '../../src/autocompleteCharacters';
import { removeCharacterCommand } from '../../src/commands/removeCharacter';
import deleteCharacter from '../../src/db/deleteCharacter';
import getCharacter from '../../src/db/getCharacter';

jest.mock('../../src/db/deleteCharacter');
jest.mock('../../src/db/getCharacter');

const mockDeleteCharacter = deleteCharacter as jest.MockedFunction<
  typeof deleteCharacter
>;
const mockGetCharacter = getCharacter as jest.MockedFunction<
  typeof getCharacter
>;

const { execute, handleButton } = removeCharacterCommand;

function createInteraction(
  name?: string,
): APIChatInputApplicationCommandInteraction {
  return {
    data: {
      name: 'remove-character',
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

function createButtonInteraction(
  customId: string,
): APIMessageComponentButtonInteraction {
  return {
    data: { custom_id: customId, component_type: ComponentType.Button },
    member: { user: { id: 'user1', username: 'thrall_fan' } },
  } as unknown as APIMessageComponentButtonInteraction;
}

describe('remove-character command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCharacter.mockResolvedValue(undefined);
    mockDeleteCharacter.mockResolvedValue();
  });

  it('is registered as /remove-character, autocompleting the name', () => {
    const json = removeCharacterCommand.builder.toJSON();

    expect(json.name).toBe('remove-character');
    expect(
      json.options?.find((option) => option.name === 'name'),
    ).toMatchObject({ autocomplete: true });
    expect(removeCharacterCommand.autocomplete).toBe(autocompleteCharacters);
  });

  it('rejects a non chat input interaction', async () => {
    await expect(
      execute({
        data: { type: ApplicationCommandType.Message },
      } as unknown as APIMessageApplicationCommandInteraction),
    ).rejects.toThrow('Expected a chat input interaction');
  });

  it('throws when the name option is missing', async () => {
    await expect(execute(createInteraction())).rejects.toThrow(
      'Missing the name option',
    );
  });

  it('asks for confirmation with Yes/No buttons', async () => {
    mockGetCharacter.mockResolvedValue({
      userId: 'user1',
      name: 'Grom Hellscream',
      level: 42,
      updatedAt: new Date(),
    });

    const response = await execute(createInteraction(' grom  hellscream'));

    expect(mockGetCharacter).toHaveBeenCalledWith('user1', 'grom hellscream');
    expect(mockDeleteCharacter).not.toHaveBeenCalled();
    expect(response).toEqual({
      content:
        "Remove **Grom Hellscream** (level 42) and its whole level history? This can't be undone.",
      components: [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.Button,
              style: ButtonStyle.Danger,
              label: 'Yes, remove',
              custom_id: 'remove-character:yes:Grom Hellscream',
            },
            {
              type: ComponentType.Button,
              style: ButtonStyle.Secondary,
              label: 'No',
              custom_id: 'remove-character:no:Grom Hellscream',
            },
          ],
        },
      ],
    });
  });

  it("leaves out the level of a character that doesn't have one", async () => {
    mockGetCharacter.mockResolvedValue({ userId: 'user1', name: 'Jaina' });

    const response = await execute(createInteraction('Jaina'));

    expect(response.content).toBe(
      "Remove **Jaina** and its whole level history? This can't be undone.",
    );
  });

  it("says so when the user doesn't have the character", async () => {
    const response = await execute(createInteraction('Jaina'));

    expect(response).toEqual({
      content: 'You have no character named **Jaina**.',
    });
  });

  describe('buttons', () => {
    it('removes the character on Yes', async () => {
      const response = await handleButton!(
        createButtonInteraction('remove-character:yes:Grom Hellscream'),
      );

      expect(mockDeleteCharacter).toHaveBeenCalledWith(
        'user1',
        'Grom Hellscream',
      );
      expect(response).toEqual({
        content: 'Removed **Grom Hellscream**.',
        components: [],
      });
    });

    it('keeps the character on No', async () => {
      const response = await handleButton!(
        createButtonInteraction('remove-character:no:Grom Hellscream'),
      );

      expect(mockDeleteCharacter).not.toHaveBeenCalled();
      expect(response).toEqual({
        content: 'Kept **Grom Hellscream**.',
        components: [],
      });
    });

    it('throws on an unknown button', async () => {
      await expect(
        handleButton!(createButtonInteraction('remove-character:maybe:Grom')),
      ).rejects.toThrow('Unknown button remove-character:maybe:Grom');
    });
  });
});
