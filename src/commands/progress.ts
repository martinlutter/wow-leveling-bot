import {
  escapeMarkdown,
  SlashCommandBuilder,
  time,
  TimestampStyles,
  userMention,
} from '@discordjs/builders';
import { isChatInputApplicationCommandInteraction } from 'discord-api-types/utils';
import {
  type APIChatInputApplicationCommandInteraction,
  type APIEmbedField,
  type APIMessageApplicationCommandInteraction,
  ApplicationCommandOptionType,
} from 'discord-api-types/v10';
import { type Command, type CommandResponse } from '..';
import autocompleteCharacters from '../autocompleteCharacters';
import {
  formatCharacterName,
  MAX_CHARACTER_NAME_LENGTH,
  normalizeCharacterName,
} from '../characterName';
import getCharacter from '../db/getCharacter';
import getFirstRecord from '../db/getFirstRecord';
import getUserCharacters from '../db/getUserCharacters';
import { type Character, hasLevel } from '../db/model/character';
import {
  DAY_MS,
  formatPace,
  getEtaDays,
  getPace,
  isStale,
  MAX_LEVEL,
} from '../leveling';

const MAX_FIELDS = 25;

const builder = new SlashCommandBuilder()
  .setName('progress')
  .setDescription('Show leveling progress, pace and ETA to 60')
  .addUserOption((option) =>
    option.setName('user').setDescription('Whose progress, yours by default'),
  )
  .addStringOption((option) =>
    option
      .setName('character')
      .setDescription('One character, all of them by default')
      .setMaxLength(MAX_CHARACTER_NAME_LENGTH)
      .setAutocomplete(true),
  );

const execute = async (
  interaction:
    | APIChatInputApplicationCommandInteraction
    | APIMessageApplicationCommandInteraction,
): Promise<CommandResponse> => {
  if (!isChatInputApplicationCommandInteraction(interaction)) {
    throw new Error('Expected a chat input interaction');
  }

  const options = interaction.data.options ?? [];
  const userOption = options.find((option) => option.name === 'user');
  const characterOption = options.find((option) => option.name === 'character');
  const callerId = (interaction.member?.user ?? interaction.user)!.id;
  const userId =
    userOption?.type === ApplicationCommandOptionType.User
      ? userOption.value
      : callerId;
  const whoHas =
    userId === callerId ? 'You have' : `${userMention(userId)} has`;

  let characters: Character[];
  if (characterOption?.type === ApplicationCommandOptionType.String) {
    const name = normalizeCharacterName(characterOption.value);
    const found = await getCharacter(userId, name);
    if (!found) {
      return {
        content: `${whoHas} no character named ${formatCharacterName(name)}.`,
      };
    }
    characters = [found];
  } else {
    characters = await getUserCharacters(userId);
    if (!characters.length) {
      return { content: `${whoHas} no characters yet.` };
    }
  }

  const now = new Date();
  const fields = await Promise.all(
    characters
      .slice(0, MAX_FIELDS)
      .map((character) => describeProgress(character, now)),
  );

  return {
    public: true,
    embeds: [
      {
        title: '📈 Leveling progress',
        description: userMention(userId),
        fields,
        footer: { text: 'ETA assumes a steady pace; late levels take longer.' },
      },
    ],
    // Names are user input: never let them ping anyone
    allowed_mentions: { parse: [] },
  };
};

async function describeProgress(
  character: Character,
  now: Date,
): Promise<APIEmbedField> {
  const name = escapeMarkdown(character.name);
  if (!hasLevel(character)) {
    return { name, value: 'No level recorded yet.' };
  }

  const firstRecord = await getFirstRecord(character);
  const pace = getPace(character, firstRecord);

  let levelLine = `Level ${character.level}`;
  if (firstRecord) {
    const since = time(firstRecord.recordedAt, TimestampStyles.ShortDate);
    levelLine += ` · started at ${firstRecord.level} on ${since} · ▲${character.level - firstRecord.level}`;
  }

  let paceLine: string;
  if (character.level >= MAX_LEVEL) {
    paceLine = 'Max level 🎉';
  } else if (pace === undefined) {
    paceLine = 'Pace — (needs records at least a day apart)';
  } else {
    const etaDays = getEtaDays(character.level, pace);
    const eta =
      etaDays === undefined
        ? 'no ETA to 60'
        : `60 in ~${etaDays} ${etaDays === 1 ? 'day' : 'days'} (${time(
            new Date(now.getTime() + etaDays * DAY_MS),
            TimestampStyles.ShortDate,
          )})`;
    paceLine = `Pace ${formatPace(pace)} · ${eta}`;
  }

  const updated = time(character.updatedAt, TimestampStyles.RelativeTime);
  const updatedLine = `Updated ${updated}${isStale(character, now) ? ' 💤' : ''}`;

  return { name, value: [levelLine, paceLine, updatedLine].join('\n') };
}

export const progressCommand: Command = {
  builder,
  execute,
  autocomplete: autocompleteCharacters,
};
