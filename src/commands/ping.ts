import { SlashCommandBuilder } from '@discordjs/builders';
import { type APIInteractionResponseCallbackData } from 'discord-api-types/v10';
import { type Command } from '..';

const builder = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Check that the bot is alive');

const execute = (): Promise<APIInteractionResponseCallbackData> =>
  Promise.resolve({ content: 'Pong!' });

export const pingCommand: Command = {
  builder,
  execute,
};
