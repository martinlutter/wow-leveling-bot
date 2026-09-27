import {
  type APIApplicationCommandAutocompleteInteraction,
  ApplicationCommandOptionType,
} from 'discord-api-types/v10';
import autocompleteCharacters from '../src/autocompleteCharacters';
import getUserCharacters from '../src/db/getUserCharacters';

jest.mock('../src/db/getUserCharacters');

const mockGetUserCharacters = getUserCharacters as jest.MockedFunction<
  typeof getUserCharacters
>;

function createInteraction(
  typed: string,
  inServer = true,
): APIApplicationCommandAutocompleteInteraction {
  const user = { id: 'user1', username: 'thrall_fan' };
  return {
    data: {
      name: 'level',
      options: [
        { name: 'level', type: ApplicationCommandOptionType.Integer, value: 5 },
        {
          name: 'character',
          type: ApplicationCommandOptionType.String,
          value: typed,
          focused: true,
        },
      ],
    },
    ...(inServer ? { member: { user } } : { user }),
  } as unknown as APIApplicationCommandAutocompleteInteraction;
}

describe('autocompleteCharacters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserCharacters.mockResolvedValue([
      {
        userId: 'user1',
        name: 'Grom Hellscream',
        level: 42,
        updatedAt: new Date(),
      },
      { userId: 'user1', name: 'Thrall' },
    ]);
  });

  it("suggests all the user's characters, with their level if they have one", async () => {
    const choices = await autocompleteCharacters(createInteraction(''));

    expect(mockGetUserCharacters).toHaveBeenCalledWith('user1');
    expect(choices).toEqual([
      { name: 'Grom Hellscream · level 42', value: 'Grom Hellscream' },
      { name: 'Thrall', value: 'Thrall' },
    ]);
  });

  it('keeps the names containing what was typed, ignoring case and extra spaces', async () => {
    const choices = await autocompleteCharacters(
      createInteraction('  M   HELL'),
    );

    expect(choices).toEqual([
      { name: 'Grom Hellscream · level 42', value: 'Grom Hellscream' },
    ]);
  });

  it('works outside of a server', async () => {
    await autocompleteCharacters(createInteraction('', false));

    expect(mockGetUserCharacters).toHaveBeenCalledWith('user1');
  });

  it('suggests at most 25 characters', async () => {
    mockGetUserCharacters.mockResolvedValue(
      Array.from({ length: 30 }, (_, i) => ({
        userId: 'user1',
        name: `Char${i}`,
      })),
    );

    const choices = await autocompleteCharacters(createInteraction(''));

    expect(choices).toHaveLength(25);
  });
});
