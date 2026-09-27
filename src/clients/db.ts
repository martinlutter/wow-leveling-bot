import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDB();
export const db = DynamoDBDocument.from(client, {
  // Optional attributes (e.g. a character's level before its first /level) are left out of the item
  marshallOptions: { removeUndefinedValues: true },
});
