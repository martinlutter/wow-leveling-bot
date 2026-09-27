import {
  type APIApplicationCommandAutocompleteInteraction,
  type APIApplicationCommandOptionChoice,
  ApplicationCommandOptionType,
} from 'discord-api-types/v10';
import { normalizeCharacterName } from './characterName';
import getUserCharacters from './db/getUserCharacters';
import { hasLevel } from './db/model/character';

const MAX_CHOICES = 25;

/** Suggests the user's own characters whose name contains what they've typed so far. */
export default async function autocompleteCharacters(
  interaction: APIApplicationCommandAutocompleteInteraction,
): Promise<APIApplicationCommandOptionChoice[]> {
  const focused = interaction.data.options.find(
    (option) => 'focused' in option && option.focused,
  );
  const typed =
    focused?.type === ApplicationCommandOptionType.String
      ? normalizeCharacterName(focused.value).toLowerCase()
      : '';
  const user = (interaction.member?.user ?? interaction.user)!;
  const characters = await getUserCharacters(user.id);

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
