import {
  InvocationType,
  InvokeCommand,
  LambdaClient,
} from '@aws-sdk/client-lambda';
import {
  type APIGatewayProxyEvent,
  type APIGatewayProxyResult,
} from 'aws-lambda';
import {
  APIPingInteraction,
  MessageFlags,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  RESTPostAPIContextMenuApplicationCommandsJSONBody,
  type APIChatInputApplicationCommandInteraction,
  type APIInteractionResponseCallbackData,
  type APIMessageApplicationCommandInteraction,
} from 'discord-api-types/v10';
import { InteractionResponseType, verifyKey } from 'discord-interactions';
import { InteractionType } from 'discord-api-types/v10';
import { pingCommand } from './commands/ping';

export interface Command {
  builder: {
    readonly name: string;
    toJSON():
      | RESTPostAPIChatInputApplicationCommandsJSONBody
      | RESTPostAPIContextMenuApplicationCommandsJSONBody;
  };
  execute: (
    interaction:
      | APIChatInputApplicationCommandInteraction
      | APIMessageApplicationCommandInteraction,
  ) => Promise<APIInteractionResponseCallbackData>;
}

export const commands = [pingCommand];

const publicKey = process.env.APPLICATION_PUBLIC_KEY!;
const executeFunctionName = process.env.EXECUTE_FUNCTION_NAME!;

const lambda = new LambdaClient();

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const lowercaseHeaders = Object.fromEntries(
    Object.entries(event.headers).map(([key, value]) => [
      key.toLowerCase(),
      value,
    ]),
  );
  const signature = lowercaseHeaders['x-signature-ed25519'];
  const timestamp = lowercaseHeaders['x-signature-timestamp'];
  const body = event.body!;

  if (!(await verifyKey(body, signature!, timestamp!, publicKey))) {
    return {
      statusCode: 401,
      body: JSON.stringify({ message: 'Invalid request signature' }),
    };
  }

  const bodyObject = JSON.parse(body) as
    APIPingInteraction | APIChatInputApplicationCommandInteraction;

  if (bodyObject.type === InteractionType.Ping) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: InteractionResponseType.PONG }),
    };
  }

  if (bodyObject.type === InteractionType.ApplicationCommand) {
    const command = commands.find(
      (command) => command.builder.name === bodyObject.data.name,
    );

    if (!command) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Command not found' }),
      };
    }

    await lambda.send(
      new InvokeCommand({
        FunctionName: executeFunctionName,
        Payload: JSON.stringify(bodyObject),
        InvocationType: InvocationType.Event,
      }),
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        data: { flags: MessageFlags.Ephemeral },
      }),
    };
  }

  return {
    statusCode: 400,
    body: JSON.stringify({ message: 'Not supported' }),
  };
};
