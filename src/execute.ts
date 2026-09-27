import {
  type APIChatInputApplicationCommandInteraction,
  type APIInteractionResponseCallbackData,
} from 'discord-api-types/v10';
import { commands } from '.';
import { discordApi } from './clients/discordApi';

export const handler = async (
  interaction: APIChatInputApplicationCommandInteraction,
): Promise<void> => {
  const command = commands.find(
    (command) => command.builder.name === interaction.data.name,
  )!;

  let response: APIInteractionResponseCallbackData;
  try {
    response = await command.execute(interaction);
  } catch (error) {
    console.error(`Command ${interaction.data.name} failed`, error);
    response = { content: 'Something went wrong, please try again later.' };
  }

  await discordApi.interactions.followUp(
    interaction.application_id,
    interaction.token,
    response,
  );
};
