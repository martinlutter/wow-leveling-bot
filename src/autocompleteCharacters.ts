import {
  type APIApplicationCommandAutocompleteInteraction,
  type APIApplicationCommandOptionChoice,
  ApplicationCommandOptionType,
} from 'discord-api-types/v10';
import { normalizeCharacterName } from './characterName';
import getUserCharacters from './db/getUserCharacters';
import { hasLevel } from './db/model/character';

const MAX_CHOICES = 25;

/**
 * Suggests characters whose name contains what's been typed so far: those of the user in the command's `user` option
 * if it's filled in, otherwise the caller's own.
 */
export default async function autocompleteCharacters(
  interaction: APIApplicationCommandAutocompleteInteraction,
): Promise<APIApplicationCommandOptionChoice[]> {
  const { options } = interaction.data;
  const focused = options.find(
    (option) => 'focused' in option && option.focused,
  );
  const typed =
    focused?.type === ApplicationCommandOptionType.String
      ? normalizeCharacterName(focused.value).toLowerCase()
      : '';
  const userOption = options.find((option) => option.name === 'user');
  const userId =
    userOption?.type === ApplicationCommandOptionType.User
      ? userOption.value
      : (interaction.member?.user ?? interaction.user)!.id;
  const characters = await getUserCharacters(userId);

  return characters
    .filter((character) => character.name.toLowerCase().includes(typed))
    .slice(0, MAX_CHOICES)
    .map((character) => ({
      name: hasLevel(character)
        ? `${character.name} · level ${character.level}`
        : character.name,
      value: character.name,
    }));
}
