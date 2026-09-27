import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { db } from '../clients/db';
import { tableName } from './constants';
import {
  DynamoCharacterKeys,
  mapCharacterToDynamoItem,
} from './model/character';

/** The user already has a character with this name (case-insensitively). */
export class CharacterExistsError extends Error {
  constructor() {
    super('The character already exists');
    this.name = 'CharacterExistsError';
  }
}

/** Creates a character without a level. Throws CharacterExistsError if the user already has it. */
export default async function addCharacter(
  userId: string,
  name: string,
): Promise<void> {
  try {
    await db.put({
      TableName: tableName,
      Item: mapCharacterToDynamoItem({ userId, name }),
      ConditionExpression: 'attribute_not_exists(#pk)',
      ExpressionAttributeNames: { '#pk': DynamoCharacterKeys.pk },
    });
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      throw new CharacterExistsError();
    }
    throw error;
  }
}
