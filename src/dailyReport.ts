import { time, TimestampStyles, userMention } from '@discordjs/builders';
import { type APIEmbed } from 'discord-api-types/v10';
import { discordApi } from './clients/discordApi';
import getAllCharacters from './db/getAllCharacters';
import getFirstRecord from './db/getFirstRecord';
import getLevelAt from './db/getLevelAt';
import { formatCharacterName } from './characterName';
import { hasLevel, type LeveledCharacter } from './db/model/character';
import { DAY_MS, formatPace, getPace, isStale } from './leveling';

const reportChannelId = process.env.REPORT_CHANNEL_ID!;

const EMBED_DESCRIPTION_LIMIT = 4096;

// Stateless: the 24h change and the pace come from the level history, so a retry posts the same report
export const handler = async (): Promise<void> => {
  const embed = await buildReport(new Date());
  await discordApi.channels.createMessage(reportChannelId, {
    embeds: [embed],
  });
};

async function buildReport(now: Date): Promise<APIEmbed> {
  const title = '📜 Daily leveling report';
  // Added characters without a level have nothing to report yet
  const characters = (await getAllCharacters()).filter(hasLevel);
  if (!characters.length) {
    return {
      title,
      description: 'Nobody has recorded a level yet. Use `/level` to start!',
    };
  }

  const dayAgo = new Date(now.getTime() - DAY_MS);
  const rows = await Promise.all(
    characters.map(async (character) => {
      const [levelDayAgo, firstRecord] = await Promise.all([
        getLevelAt(character, dayAgo),
        getFirstRecord(character),
      ]);
      return {
        character,
        levelDayAgo,
        pace: getPace(character, firstRecord),
        stale: isStale(character, now),
      };
    }),
  );
  rows.sort(
    (a, b) =>
      b.character.level - a.character.level ||
      a.character.name.localeCompare(b.character.name),
  );

  const anyLevelUps = rows.some(
    ({ character, levelDayAgo }) =>
      levelDayAgo !== undefined && character.level > levelDayAgo,
  );
  const summary = anyLevelUps ? [] : ['*No level-ups in the last 24 hours.*'];

  return {
    title,
    description: fitLines(rows.map(formatRow), summary),
    timestamp: now.toISOString(),
  };
}

function formatRow({
  character,
  levelDayAgo,
  pace,
  stale,
}: {
  character: LeveledCharacter;
  levelDayAgo: number | undefined;
  pace: number | undefined;
  stale: boolean;
}): string {
  let change: string;
  if (levelDayAgo === undefined) {
    change = '🆕';
  } else if (character.level > levelDayAgo) {
    change = `▲${character.level - levelDayAgo}`;
  } else {
    change = '—';
  }

  // Left out until there is one: "Lv 12 — · —" would be confusing
  const paceText = pace === undefined ? '' : ` · ${formatPace(pace)}`;
  const updated = time(character.updatedAt, TimestampStyles.RelativeTime);
  return `${formatCharacterName(character.name)} (${userMention(character.userId)}) Lv ${character.level} ${change}${paceText} · updated ${updated}${stale ? ' 💤' : ''}`;
}

/** Drops rows from the end until the description fits in an embed. */
function fitLines(rows: string[], summary: string[]): string {
  const join = (shown: string[]) => {
    const hidden = rows.length - shown.length;
    return [
      ...summary,
      ...shown,
      ...(hidden ? [`…and ${hidden} more`] : []),
    ].join('\n');
  };

  let shown = rows;
  while (join(shown).length > EMBED_DESCRIPTION_LIMIT) {
    shown = shown.slice(0, -1);
  }
  return join(shown);
}
