import { SlashCommandBuilder } from '@discordjs/builders';
import { isChatInputApplicationCommandInteraction } from 'discord-api-types/utils';
import {
  type APIChatInputApplicationCommandInteraction,
  type APIInteractionResponseCallbackData,
  type APIMessageApplicationCommandInteraction,
  ApplicationCommandOptionType,
} from 'discord-api-types/v10';
import { type Command } from '..';
import {
  formatCharacterName,
  isValidCharacterName,
  MAX_CHARACTER_NAME_LENGTH,
  normalizeCharacterName,
} from '../characterName';
import addCharacter, { CharacterExistsError } from '../db/addCharacter';

const builder = new SlashCommandBuilder()
  .setName('add-character')
  .setDescription('Add a character to record levels for')
  .addStringOption((option) =>
    option
      .setName('name')
      .setDescription('Character name, one or two words')
      .setRequired(true)
      .setMaxLength(MAX_CHARACTER_NAME_LENGTH),
  );

const execute = async (
  interaction:
    | APIChatInputApplicationCommandInteraction
    | APIMessageApplicationCommandInteraction,
): Promise<APIInteractionResponseCallbackData> => {
  if (!isChatInputApplicationCommandInteraction(interaction)) {
    throw new Error('Expected a chat input interaction');
  }

  const nameOption = interaction.data.options?.find(
    (option) => option.name === 'name',
  );
  if (nameOption?.type !== ApplicationCommandOptionType.String) {
    throw new Error('Missing the name option');
  }
  const name = normalizeCharacterName(nameOption.value);
  if (!isValidCharacterName(name)) {
    return {
      content: 'A character name has one or two words, like `Grom Hellscream`.',
    };
  }

  const user = (interaction.member?.user ?? interaction.user)!;
  try {
    await addCharacter(user.id, name);
  } catch (error) {
    if (error instanceof CharacterExistsError) {
      return { content: `You already have ${formatCharacterName(name)}.` };
    }
    throw error;
  }

  return {
    content: `Added ${formatCharacterName(name)}. Record its level with \`/level\`.`,
  };
};

export const addCharacterCommand: Command = { builder, execute };
