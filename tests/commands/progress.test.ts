import {
  type APIApplicationCommandInteractionDataOption,
  type APIChatInputApplicationCommandInteraction,
  type APIEmbed,
  type APIMessageApplicationCommandInteraction,
  ApplicationCommandOptionType,
  ApplicationCommandType,
} from 'discord-api-types/v10';
import autocompleteCharacters from '../../src/autocompleteCharacters';
import { progressCommand } from '../../src/commands/progress';
import getCharacter from '../../src/db/getCharacter';
import getFirstRecord from '../../src/db/getFirstRecord';
import getUserCharacters from '../../src/db/getUserCharacters';
import { type Character } from '../../src/db/model/character';

jest.mock('../../src/db/getCharacter');
jest.mock('../../src/db/getFirstRecord');
jest.mock('../../src/db/getUserCharacters');

const mockGetCharacter = getCharacter as jest.MockedFunction<
  typeof getCharacter
>;
const mockGetFirstRecord = getFirstRecord as jest.MockedFunction<
  typeof getFirstRecord
>;
const mockGetUserCharacters = getUserCharacters as jest.MockedFunction<
  typeof getUserCharacters
>;

const now = new Date('2026-09-27T05:00:00.000Z');
const updatedAt = new Date('2026-09-26T05:00:00.000Z');
const firstRecordedAt = new Date('2026-09-16T05:00:00.000Z');

/** Discord's `<t:…:style>` markup for an ISO time. */
const ts = (iso: string, style: 'd' | 'R') =>
  `<t:${Date.parse(iso) / 1000}:${style}>`;

function createCharacter(
  name: string,
  level?: number,
  updated = updatedAt,
): Character {
  return level === undefined
    ? { userId: 'user1', name }
    : { userId: 'user1', name, level, updatedAt: updated };
}

function createInteraction(
  options: { user?: string; character?: string } = {},
  inServer = true,
): APIChatInputApplicationCommandInteraction {
  const data: APIApplicationCommandInteractionDataOption[] = [];
  if (options.user !== undefined) {
    data.push({
      name: 'user',
      type: ApplicationCommandOptionType.User,
      value: options.user,
    });
  }
  if (options.character !== undefined) {
    data.push({
      name: 'character',
      type: ApplicationCommandOptionType.String,
      value: options.character,
    });
  }
  const user = { id: 'user1', username: 'thrall_fan' };

  return {
    data: {
      name: 'progress',
      type: ApplicationCommandType.ChatInput,
      options: data,
    },
    ...(inServer ? { member: { user } } : { user }),
  } as unknown as APIChatInputApplicationCommandInteraction;
}

/** Runs the command and returns the single embed of its public reply. */
async function runForEmbed(
  interaction = createInteraction(),
): Promise<APIEmbed> {
  const response = await progressCommand.execute(interaction);
  expect(response.public).toBe(true);
  expect(response.allowed_mentions).toEqual({ parse: [] });
  expect(response.embeds).toHaveLength(1);
  return response.embeds![0];
}

describe('progress command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now });
    mockGetFirstRecord.mockResolvedValue({
      level: 10,
      recordedAt: firstRecordedAt,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows all of the caller's characters with their pace and ETA", async () => {
    mockGetUserCharacters.mockResolvedValue([
      createCharacter('Grom_Hellscream', 25),
      createCharacter('Thrall'),
    ]);

    const embed = await runForEmbed();

    expect(mockGetUserCharacters).toHaveBeenCalledWith('user1');
    expect(mockGetFirstRecord).toHaveBeenCalledTimes(1);
    expect(mockGetFirstRecord).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Grom_Hellscream' }),
    );
    // 15 levels in 10 days → 1.5/day; 35 levels to go → 24 days
    expect(embed).toEqual({
      title: '📈 Leveling progress',
      description: '<@user1>',
      fields: [
        {
          name: 'Grom\\_Hellscream',
          value: [
            `Level 25 · started at 10 on ${ts('2026-09-16T05:00:00.000Z', 'd')} · ▲15`,
            `Pace 1.5/day · 60 in ~24 days (${ts('2026-10-21T05:00:00.000Z', 'd')})`,
            `Updated ${ts('2026-09-26T05:00:00.000Z', 'R')}`,
          ].join('\n'),
        },
        { name: 'Thrall', value: 'No level recorded yet.' },
      ],
      footer: { text: 'ETA assumes a steady pace; late levels take longer.' },
    });
  });

  it("shows another user's character", async () => {
    mockGetCharacter.mockResolvedValue({
      ...createCharacter('Jaina Proudmoore', 25),
      userId: 'user2',
    });

    const embed = await runForEmbed(
      createInteraction({ user: 'user2', character: '  jaina   proudmoore ' }),
    );

    expect(mockGetCharacter).toHaveBeenCalledWith('user2', 'jaina proudmoore');
    expect(mockGetUserCharacters).not.toHaveBeenCalled();
    expect(embed.description).toBe('<@user2>');
    expect(embed.fields).toHaveLength(1);
    expect(embed.fields![0].name).toBe('Jaina Proudmoore');
  });

  it('works outside of a server', async () => {
    mockGetUserCharacters.mockResolvedValue([createCharacter('Thrall')]);

    await runForEmbed(createInteraction({}, false));

    expect(mockGetUserCharacters).toHaveBeenCalledWith('user1');
  });

  it('privately rejects an unknown character of the caller', async () => {
    mockGetCharacter.mockResolvedValue(undefined);

    const response = await progressCommand.execute(
      createInteraction({ character: 'Arthas' }),
    );

    expect(response).toEqual({
      content: 'You have no character named **Arthas**.',
    });
  });

  it('privately rejects an unknown character of another user', async () => {
    mockGetCharacter.mockResolvedValue(undefined);

    const response = await progressCommand.execute(
      createInteraction({ user: 'user2', character: 'Arthas' }),
    );

    expect(response).toEqual({
      content: '<@user2> has no character named **Arthas**.',
    });
  });

  it('privately says so when the user has no characters', async () => {
    mockGetUserCharacters.mockResolvedValue([]);

    expect(await progressCommand.execute(createInteraction())).toEqual({
      content: 'You have no characters yet.',
    });
    expect(
      await progressCommand.execute(createInteraction({ user: 'user2' })),
    ).toEqual({ content: '<@user2> has no characters yet.' });
  });

  it('explains a missing pace', async () => {
    mockGetUserCharacters.mockResolvedValue([createCharacter('Thrall', 12)]);
    mockGetFirstRecord.mockResolvedValue({ level: 12, recordedAt: updatedAt });

    const embed = await runForEmbed();

    expect(embed.fields![0].value).toBe(
      [
        `Level 12 · started at 12 on ${ts('2026-09-26T05:00:00.000Z', 'd')} · ▲0`,
        'Pace — (needs records at least a day apart)',
        `Updated ${ts('2026-09-26T05:00:00.000Z', 'R')}`,
      ].join('\n'),
    );
  });

  it('has no ETA without progress', async () => {
    mockGetUserCharacters.mockResolvedValue([createCharacter('Thrall', 10)]);

    const embed = await runForEmbed();

    expect(embed.fields![0].value).toContain('Pace 0.0/day · no ETA to 60');
  });

  it('says "day" for an ETA of one day', async () => {
    mockGetUserCharacters.mockResolvedValue([createCharacter('Thrall', 59)]);

    const embed = await runForEmbed();

    expect(embed.fields![0].value).toContain('60 in ~1 day (');
  });

  it('marks a stale character', async () => {
    const staleSince = new Date('2026-09-23T05:00:00.000Z');
    mockGetUserCharacters.mockResolvedValue([
      createCharacter('Thrall', 25, staleSince),
    ]);

    const embed = await runForEmbed();

    expect(embed.fields![0].value).toMatch(/\nUpdated <t:\d+:R> 💤$/);
  });

  it('shows max level instead of a pace, and never as stale', async () => {
    mockGetUserCharacters.mockResolvedValue([
      createCharacter('Thrall', 60, new Date('2026-01-01T00:00:00.000Z')),
    ]);

    const embed = await runForEmbed();

    const [, paceLine, updatedLine] = embed.fields![0].value.split('\n');
    expect(paceLine).toBe('Max level 🎉');
    expect(updatedLine).not.toContain('💤');
  });

  it('shows at most 25 characters', async () => {
    mockGetUserCharacters.mockResolvedValue(
      Array.from({ length: 30 }, (_, i) => createCharacter(`Char${i}`)),
    );

    const embed = await runForEmbed();

    expect(embed.fields).toHaveLength(25);
  });

  it('rejects a non chat input interaction', async () => {
    await expect(
      progressCommand.execute({
        data: { type: ApplicationCommandType.Message },
      } as unknown as APIMessageApplicationCommandInteraction),
    ).rejects.toThrow('Expected a chat input interaction');
  });

  it('autocompletes characters', () => {
    expect(progressCommand.autocomplete).toBe(autocompleteCharacters);
  });
});
