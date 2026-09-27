import { API } from '@discordjs/core/http-only';
import { REST } from '@discordjs/rest';
import { config } from 'dotenv';

config({ quiet: true });
const discordToken = process.env.DISCORD_TOKEN!;

export const discordRest = new REST({ version: '10' }).setToken(discordToken);
export const discordApi = new API(discordRest);
