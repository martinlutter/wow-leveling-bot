import { Routes } from 'discord-api-types/v10';
import { config } from 'dotenv';
config({ quiet: true });
import { commands } from '../src';
import { discordRest } from '../src/clients/discordApi';

const clientId = process.env.APPLICATION_CLIENT_ID!;
const guildId = process.env.GUILD_ID!;

void (async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await discordRest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commands.map((command) => command.builder.toJSON()),
    });

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();
