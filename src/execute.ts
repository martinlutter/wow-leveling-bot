import {
  type APIChatInputApplicationCommandInteraction,
  type APIInteractionResponseCallbackData,
  type APIMessageComponentButtonInteraction,
  InteractionType,
} from 'discord-api-types/v10';
import { type CommandResponse, findButtonCommand, findCommand } from '.';
import { discordApi } from './clients/discordApi';

export const handler = async (
  interaction:
    | APIChatInputApplicationCommandInteraction
    | APIMessageComponentButtonInteraction,
): Promise<void> => {
  const { application_id: applicationId, token } = interaction;

  if (interaction.type === InteractionType.MessageComponent) {
    const command = findButtonCommand(interaction.data.custom_id)!;
    const response = await respond(`Button ${interaction.data.custom_id}`, () =>
      command.handleButton!(interaction),
    );
    await discordApi.interactions.editReply(applicationId, token, response);
    return;
  }

  const command = findCommand(interaction.data.name)!;
  const { public: isPublic, ...data } = await respond(
    `Command ${interaction.data.name}`,
    () => command.execute(interaction),
  );
  if (isPublic) {
    await sendPublic(interaction, data);
  } else {
    await discordApi.interactions.followUp(applicationId, token, data);
  }
};

async function respond(
  name: string,
  run: () => Promise<CommandResponse>,
): Promise<CommandResponse> {
  try {
    return await run();
  } catch (error) {
    console.error(`${name} failed`, error);
    return { content: 'Something went wrong, please try again later.' };
  }
}

/**
 * The deferred reply is ephemeral and can't be made public, so post the result to the channel as a plain message and
 * delete the ephemeral reply.
 */
async function sendPublic(
  interaction: APIChatInputApplicationCommandInteraction,
  data: APIInteractionResponseCallbackData,
): Promise<void> {
  const { application_id: applicationId, token } = interaction;
  try {
    await discordApi.channels.createMessage(interaction.channel.id, data);
  } catch (error) {
    // Most likely no Send Messages permission in this channel. A follow-up needs no permissions, but it shows as a
    // reply to the deleted ephemeral one. The first follow-up only fills in the deferred reply, so resolve it first.
    console.error('Posting to the channel failed, using a follow-up', error);
    await discordApi.interactions.editReply(applicationId, token, {
      content: 'Posting…',
    });
    await discordApi.interactions.followUp(applicationId, token, data);
  }
  await discordApi.interactions.deleteReply(applicationId, token);
}
