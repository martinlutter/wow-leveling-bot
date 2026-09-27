import { App, CfnOutput, Duration, Stack } from 'aws-cdk-lib';
import { LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { config } from 'dotenv';

config({ quiet: true });
const botName = 'WowLevelingRecorderBot';

const app = new App();
const stack = new Stack(app, botName);

const commonEnvVars = {
  DISCORD_TOKEN: process.env.DISCORD_TOKEN!,
};

const executeLambda = new NodejsFunction(stack, 'Execute', {
  runtime: Runtime.NODEJS_24_X,
  entry: 'src/execute.ts',
  bundling: {
    minify: true,
  },
  environment: commonEnvVars,
  logGroup: new LogGroup(stack, 'ExecuteLogs', {
    retention: RetentionDays.ONE_MONTH,
  }),
  timeout: Duration.seconds(10),
  memorySize: 256,
});

const interactionLambda = new NodejsFunction(stack, 'Interaction', {
  runtime: Runtime.NODEJS_24_X,
  entry: 'src/index.ts',
  bundling: {
    minify: true,
  },
  environment: {
    APPLICATION_PUBLIC_KEY: process.env.APPLICATION_PUBLIC_KEY!,
    EXECUTE_FUNCTION_NAME: executeLambda.functionName,
    ...commonEnvVars,
  },
  logGroup: new LogGroup(stack, 'InteractionLogs', {
    retention: RetentionDays.ONE_MONTH,
  }),
  timeout: Duration.seconds(3),
  memorySize: 256,
});

executeLambda.grantInvoke(interactionLambda);

const api = new RestApi(stack, 'BotInteractionEndpoint', {
  deployOptions: {
    stageName: 'prod',
    throttlingRateLimit: 10,
    throttlingBurstLimit: 20,
  },
});

api.root.addMethod('POST', new LambdaIntegration(interactionLambda));

new CfnOutput(stack, 'InteractionsEndpointUrl', {
  value: api.url,
  description: 'Paste into Discord Developer Portal > General Information',
});

app.synth();
