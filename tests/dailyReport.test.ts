process.env.REPORT_CHANNEL_ID = 'channel1';

import { type APIEmbed } from 'discord-api-types/v10';
import { handler } from '../src/dailyReport';
import getAllCharacters from '../src/db/getAllCharacters';
import getLevelAt from '../src/db/getLevelAt';
import { type Character } from '../src/db/model/character';

const mockCreateMessage = jest.fn();
jest.mock('../src/clients/discordApi', () => ({
  discordApi: {
    channels: {
      createMessage: (...args: unknown[]): unknown =>
        mockCreateMessage(...args),
    },
  },
}));
jest.mock('../src/db/getAllCharacters');
jest.mock('../src/db/getLevelAt');

const mockGetAllCharacters = getAllCharacters as jest.MockedFunction<
  typeof getAllCharacters
>;
const mockGetLevelAt = getLevelAt as jest.MockedFunction<typeof getLevelAt>;

const now = new Date('2026-09-27T05:00:00.000Z');
const dayAgo = new Date('2026-09-26T05:00:00.000Z');
const updatedAt = new Date('2026-09-26T20:00:00.000Z');
const updated = '<t:1790452800:R>';

function createCharacter(
  userId: string,
  name: string,
  level: number,
): Character {
  return { userId, name, level, updatedAt };
}

async function runReport(
  characters: Character[],
  levelsDayAgo: Record<string, number | undefined> = {},
): Promise<APIEmbed> {
  mockGetAllCharacters.mockResolvedValue(characters);
  mockGetLevelAt.mockImplementation((character) =>
    Promise.resolve(levelsDayAgo[character.name]),
  );

  await handler();

  expect(mockCreateMessage).toHaveBeenCalledTimes(1);
  const [channelId, body] = mockCreateMessage.mock.calls[0] as [
    string,
    { embeds: APIEmbed[] },
  ];
  expect(channelId).toBe('channel1');
  expect(body.embeds).toHaveLength(1);
  return body.embeds[0];
}

describe('daily report', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now });
    mockCreateMessage.mockResolvedValue({});
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('lists characters by level, then name, with their 24h change', async () => {
    const embed = await runReport(
      [
        createCharacter('u1', 'Thrall', 12),
        createCharacter('u2', 'Jaina', 30),
        createCharacter('u3', 'Anduin', 12),
        createCharacter('u1', 'Grom', 5),
      ],
      { Thrall: 12, Jaina: 27, Anduin: 12 },
    );

    expect(mockGetLevelAt).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Thrall' }),
      dayAgo,
    );
    expect(embed).toEqual({
      title: '📜 Daily leveling report',
      description: [
        `**Jaina** (<@u2>) Lv 30 ▲3 · updated ${updated}`,
        `**Anduin** (<@u3>) Lv 12 — · updated ${updated}`,
        `**Thrall** (<@u1>) Lv 12 — · updated ${updated}`,
        `**Grom** (<@u1>) Lv 5 🆕 · updated ${updated}`,
      ].join('\n'),
      timestamp: now.toISOString(),
    });
  });

  it('says so when nobody leveled up', async () => {
    const embed = await runReport([createCharacter('u1', 'Thrall', 12)], {
      Thrall: 12,
    });

    expect(embed.description).toBe(
      `*No level-ups in the last 24 hours.*\n**Thrall** (<@u1>) Lv 12 — · updated ${updated}`,
    );
  });

  it("doesn't count a new character as a level-up", async () => {
    const embed = await runReport([createCharacter('u1', 'Thrall', 12)]);

    expect(embed.description).toMatch(
      /^\*No level-ups in the last 24 hours\.\*\n/,
    );
  });

  it('leaves out characters without a level', async () => {
    const embed = await runReport(
      [createCharacter('u1', 'Thrall', 12), { userId: 'u2', name: 'Jaina' }],
      { Thrall: 11 },
    );

    expect(mockGetLevelAt).toHaveBeenCalledTimes(1);
    expect(embed.description).toBe(
      `**Thrall** (<@u1>) Lv 12 ▲1 · updated ${updated}`,
    );
  });

  it('posts an empty state when nobody has recorded yet', async () => {
    const embed = await runReport([{ userId: 'u2', name: 'Jaina' }]);

    expect(mockGetLevelAt).not.toHaveBeenCalled();
    expect(embed).toEqual({
      title: '📜 Daily leveling report',
      description: 'Nobody has recorded a level yet. Use `/level` to start!',
    });
  });

  it('cuts the list to fit the embed limit', async () => {
    const characters = Array.from({ length: 100 }, (_, i) =>
      createCharacter(`user${i}`, `Character${String(i).padStart(3, '0')}`, 10),
    );

    const embed = await runReport(characters);

    const lines = embed.description!.split('\n');
    expect(embed.description!.length).toBeLessThanOrEqual(4096);
    expect(lines.at(-1)).toMatch(/^…and \d+ more$/);
    const hidden = Number(/\d+/.exec(lines.at(-1)!)![0]);
    // the summary line + shown rows + the "more" line
    expect(lines.length - 2 + hidden).toBe(100);
  });
});
