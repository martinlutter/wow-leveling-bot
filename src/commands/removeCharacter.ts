import { SlashCommandBuilder } from '@discordjs/builders';
import { isChatInputApplicationCommandInteraction } from 'discord-api-types/utils';
import {
  type APIChatInputApplicationCommandInteraction,
  type APIInteractionResponseCallbackData,
  type APIMessageApplicationCommandInteraction,
  type APIMessageComponentButtonInteraction,
  ApplicationCommandOptionType,
  ButtonStyle,
  ComponentType,
} from 'discord-api-types/v10';
import { type Command } from '..';
import autocompleteCharacters from '../autocompleteCharacters';
import {
  formatCharacterName,
  MAX_CHARACTER_NAME_LENGTH,
  normalizeCharacterName,
} from '../characterName';
import deleteCharacter from '../db/deleteCharacter';
import getCharacter from '../db/getCharacter';
import { hasLevel } from '../db/model/character';

const commandName = 'remove-character';

const builder = new SlashCommandBuilder()
  .setName(commandName)
  .setDescription('Remove one of your characters and its level history')
  .addStringOption((option) =>
    option
      .setName('name')
      .setDescription('Character name')
      .setRequired(true)
      .setMaxLength(MAX_CHARACTER_NAME_LENGTH)
      .setAutocomplete(true),
  );

// Button custom_id: remove-character:<yes|no>:<character name>
const toButtonId = (answer: 'yes' | 'no', name: string) =>
  `${commandName}:${answer}:${name}`;
const buttonIdPattern = new RegExp(`^${commandName}:(yes|no):(.+)$`, 's');

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
  const user = (interaction.member?.user ?? interaction.user)!;
  const character = await getCharacter(user.id, name);
  if (!character) {
    return {
      content: `You have no character named ${formatCharacterName(name)}.`,
    };
  }

  const level = hasLevel(character) ? ` (level ${character.level})` : '';
  return {
    content: `Remove ${formatCharacterName(character.name)}${level} and its whole level history? This can't be undone.`,
    components: [
      {
        type: ComponentType.ActionRow,
        components: [
          {
            type: ComponentType.Button,
            style: ButtonStyle.Danger,
            label: 'Yes, remove',
            custom_id: toButtonId('yes', character.name),
          },
          {
            type: ComponentType.Button,
            style: ButtonStyle.Secondary,
            label: 'No',
            custom_id: toButtonId('no', character.name),
          },
        ],
      },
    ],
  };
};

const handleButton = async (
  interaction: APIMessageComponentButtonInteraction,
): Promise<APIInteractionResponseCallbackData> => {
  const match = buttonIdPattern.exec(interaction.data.custom_id);
  if (!match) {
    throw new Error(`Unknown button ${interaction.data.custom_id}`);
  }
  const [, answer, name] = match;

  if (answer === 'no') {
    return { content: `Kept ${formatCharacterName(name)}.`, components: [] };
  }

  // The prompt is ephemeral, so whoever clicks is the character's owner
  const user = (interaction.member?.user ?? interaction.user)!;
  await deleteCharacter(user.id, name);
  return { content: `Removed ${formatCharacterName(name)}.`, components: [] };
};

export const removeCharacterCommand: Command = {
  builder,
  execute,
  autocomplete: autocompleteCharacters,
  handleButton,
};
