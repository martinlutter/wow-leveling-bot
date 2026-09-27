import {
  SlashCommandBuilder,
  time,
  TimestampStyles,
  userMention,
} from '@discordjs/builders';
import { isChatInputApplicationCommandInteraction } from 'discord-api-types/utils';
import {
  type APIChatInputApplicationCommandInteraction,
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
import getUserCharacters from '../db/getUserCharacters';
import { type Character, hasLevel } from '../db/model/character';
import recordLevel, { LevelDecreaseError } from '../db/recordLevel';
import { MAX_LEVEL } from '../leveling';
import { randomQuote } from '../quotes';

const builder = new SlashCommandBuilder()
  .setName('level')
  .setDescription('Record the level your character reached')
  .addIntegerOption((option) =>
    option
      .setName('level')
      .setDescription('The level your character is now')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(MAX_LEVEL),
  )
  .addStringOption((option) =>
    option
      .setName('character')
      .setDescription('Character name, needed once you have more than one')
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
  const levelOption = options.find((option) => option.name === 'level');
  if (levelOption?.type !== ApplicationCommandOptionType.Integer) {
    throw new Error('Missing the level option');
  }
  const level = levelOption.value;
  const characterOption = options.find((option) => option.name === 'character');
  const user = (interaction.member?.user ?? interaction.user)!;

  let character: Character;
  if (characterOption?.type === ApplicationCommandOptionType.String) {
    // No name validation: a name only has to match an existing character
    const name = normalizeCharacterName(characterOption.value);
    const found = await getCharacter(user.id, name);
    if (!found) {
      return {
        content: `You have no character named ${formatCharacterName(name)}. Add it with \`/add-character\`.`,
      };
    }
    character = found;
  } else {
    const characters = await getUserCharacters(user.id);
    if (characters.length > 1) {
      const list = characters.map(describeCharacter).join(', ');
      return {
        content: `You have more than one character: ${list}. Pick one with the \`character\` option.`,
      };
    }
    character = characters.at(0) ?? {
      userId: user.id,
      name: normalizeCharacterName(
        interaction.member?.nick ?? user.global_name ?? user.username,
      ),
    };
  }

  try {
    await recordLevel({
      userId: user.id,
      name: character.name,
      level,
      updatedAt: new Date(),
    });
  } catch (error) {
    if (error instanceof LevelDecreaseError) {
      return {
        content: `${formatCharacterName(character.name)} is already above level ${level}. Levels can't go down.`,
      };
    }
    throw error;
  }

  const quote = randomQuote();
  return {
    public: true,
    content: `${describeLevel(character, level)}\n> *${quote.text}* — ${quote.source}`,
    // Names are user input: never let them ping anyone
    allowed_mentions: { parse: [] },
  };
};

const describeCharacter = (character: Character) =>
  `${formatCharacterName(character.name)} (${hasLevel(character) ? `level ${character.level}` : 'no level yet'})`;

/** Describes the change from the character's previous record to `level`. */
function describeLevel(character: Character, level: number): string {
  const who = `${userMention(character.userId)}'s ${formatCharacterName(character.name)}`;

  let line: string;
  if (!hasLevel(character)) {
    line = `${who} starts at level ${level}.`;
  } else {
    const since = time(character.updatedAt, TimestampStyles.RelativeTime);
    line =
      level === character.level
        ? `${who} is still level ${level}, no change since ${since}.`
        : `${who} reached level ${level}, ▲${level - character.level} since ${since}.`;
  }

  const reachedMax = level === MAX_LEVEL && character.level !== MAX_LEVEL;
  return reachedMax ? `🎉 ${line} Max level!` : line;
}

export const levelCommand: Command = {
  builder,
  execute,
  autocomplete: autocompleteCharacters,
};
