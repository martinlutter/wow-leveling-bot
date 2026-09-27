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
  type APIApplicationCommandAutocompleteInteraction,
  type APIApplicationCommandOptionChoice,
  APIPingInteraction,
  MessageFlags,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  RESTPostAPIContextMenuApplicationCommandsJSONBody,
  type APIChatInputApplicationCommandInteraction,
  type APIInteractionResponseCallbackData,
  type APIMessageApplicationCommandInteraction,
  type APIMessageComponentButtonInteraction,
  type APIMessageComponentInteraction,
} from 'discord-api-types/v10';
import { InteractionResponseType, verifyKey } from 'discord-interactions';
import { InteractionType } from 'discord-api-types/v10';
import { addCharacterCommand } from './commands/addCharacter';
import { levelCommand } from './commands/level';
import { pingCommand } from './commands/ping';
import { removeCharacterCommand } from './commands/removeCharacter';

/** `public: true` posts the result for everyone; otherwise only the caller sees it. */
export type CommandResponse = APIInteractionResponseCallbackData & {
  public?: boolean;
};

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
  ) => Promise<CommandResponse>;
  /** Suggests values for the option being typed. Runs in the Interaction lambda, so it must be fast (< 3s). */
  autocomplete?: (
    interaction: APIApplicationCommandAutocompleteInteraction,
  ) => Promise<APIApplicationCommandOptionChoice[]>;
  /**
   * Handles a click on one of the command's buttons, whose custom_id must start with `<command name>:`. The result
   * replaces the message that holds the button.
   */
  handleButton?: (
    interaction: APIMessageComponentButtonInteraction,
  ) => Promise<APIInteractionResponseCallbackData>;
}

export const commands: Command[] = [
  pingCommand,
  levelCommand,
  addCharacterCommand,
  removeCharacterCommand,
];

export const findCommand = (name: string) =>
  commands.find((command) => command.builder.name === name);

export const findButtonCommand = (customId: string) => {
  const command = findCommand(customId.split(':')[0]);
  return command?.handleButton ? command : undefined;
};

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
    | APIPingInteraction
    | APIChatInputApplicationCommandInteraction
    | APIApplicationCommandAutocompleteInteraction
    | APIMessageComponentInteraction;

  if (bodyObject.type === InteractionType.Ping) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: InteractionResponseType.PONG }),
    };
  }

  if (bodyObject.type === InteractionType.ApplicationCommand) {
    if (!findCommand(bodyObject.data.name)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Command not found' }),
      };
    }

    await invokeExecute(bodyObject);

    return {
      statusCode: 200,
      body: JSON.stringify({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        data: { flags: MessageFlags.Ephemeral },
      }),
    };
  }

  // Answered right here: autocomplete can't be deferred
  if (bodyObject.type === InteractionType.ApplicationCommandAutocomplete) {
    let choices: APIApplicationCommandOptionChoice[] = [];
    try {
      choices =
        (await findCommand(bodyObject.data.name)?.autocomplete?.(bodyObject)) ??
        [];
    } catch (error) {
      console.error(`Autocomplete for ${bodyObject.data.name} failed`, error);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
        data: { choices },
      }),
    };
  }

  if (bodyObject.type === InteractionType.MessageComponent) {
    if (!findButtonCommand(bodyObject.data.custom_id)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Button not found' }),
      };
    }

    await invokeExecute(bodyObject);

    // Execute edits the message that holds the button
    return {
      statusCode: 200,
      body: JSON.stringify({
        type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
      }),
    };
  }

  return {
    statusCode: 400,
    body: JSON.stringify({ message: 'Not supported' }),
  };
};

async function invokeExecute(
  interaction:
    APIChatInputApplicationCommandInteraction | APIMessageComponentInteraction,
): Promise<void> {
  await lambda.send(
    new InvokeCommand({
      FunctionName: executeFunctionName,
      Payload: JSON.stringify(interaction),
      InvocationType: InvocationType.Event,
    }),
  );
}
