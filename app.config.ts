import {
  App,
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  TimeZone,
} from 'aws-cdk-lib';
import { LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { AttributeType, TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Schedule, ScheduleExpression } from 'aws-cdk-lib/aws-scheduler';
import { LambdaInvoke } from 'aws-cdk-lib/aws-scheduler-targets';
import { config } from 'dotenv';

config({ quiet: true });
const botName = 'WowLevelingRecorderBot';

const app = new App();
const stack = new Stack(app, botName);

const table = new TableV2(stack, 'Table', {
  partitionKey: { name: 'pk', type: AttributeType.STRING },
  sortKey: { name: 'sk', type: AttributeType.STRING },
  removalPolicy: RemovalPolicy.RETAIN,
  timeToLiveAttribute: 'ttl',
});

const commonEnvVars = {
  DISCORD_TOKEN: process.env.DISCORD_TOKEN!,
};

const executeLambda = new NodejsFunction(stack, 'Execute', {
  runtime: Runtime.NODEJS_24_X,
  entry: 'src/execute.ts',
  bundling: {
    minify: true,
  },
  environment: {
    TABLE_NAME: table.tableName,
    ...commonEnvVars,
  },
  logGroup: new LogGroup(stack, 'ExecuteLogs', {
    retention: RetentionDays.ONE_MONTH,
  }),
  timeout: Duration.seconds(10),
  memorySize: 256,
  // A retry would repeat what already succeeded, e.g. post a public reply twice
  retryAttempts: 0,
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
    TABLE_NAME: table.tableName,
    ...commonEnvVars,
  },
  logGroup: new LogGroup(stack, 'InteractionLogs', {
    retention: RetentionDays.ONE_MONTH,
  }),
  timeout: Duration.seconds(3),
  memorySize: 256,
});

executeLambda.grantInvoke(interactionLambda);
table.grantReadWriteData(executeLambda);
table.grantReadData(interactionLambda); // autocomplete

const dailyReportLambda = new NodejsFunction(stack, 'DailyReport', {
  runtime: Runtime.NODEJS_24_X,
  entry: 'src/dailyReport.ts',
  bundling: {
    minify: true,
  },
  environment: {
    REPORT_CHANNEL_ID: process.env.REPORT_CHANNEL_ID!,
    TABLE_NAME: table.tableName,
    ...commonEnvVars,
  },
  logGroup: new LogGroup(stack, 'DailyReportLogs', {
    retention: RetentionDays.ONE_MONTH,
  }),
  timeout: Duration.seconds(30),
  memorySize: 256,
});

table.grantReadData(dailyReportLambda);

// 07:00 Central European time, following DST (Berlin is the same as any other CET/CEST zone)
new Schedule(stack, 'DailyReportSchedule', {
  schedule: ScheduleExpression.cron({
    minute: '0',
    hour: '7',
    timeZone: TimeZone.EUROPE_BERLIN,
  }),
  target: new LambdaInvoke(dailyReportLambda),
});

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
