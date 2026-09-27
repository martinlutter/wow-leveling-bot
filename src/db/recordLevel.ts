import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import { db } from '../clients/db';
import { tableName } from './constants';
import {
  DynamoCharacterKeys,
  type LeveledCharacter,
  mapCharacterToDynamoItem,
} from './model/character';
import { mapLevelRecordToDynamoItem } from './model/levelRecord';

/** The character is already at a higher level than the one being recorded. */
export class LevelDecreaseError extends Error {
  constructor() {
    super('The character is already at a higher level');
    this.name = 'LevelDecreaseError';
  }
}

/**
 * Saves the character's new level and a history record of it, creating the character if needed. Throws
 * LevelDecreaseError if the stored level is higher, which also covers two commands racing each other.
 */
export default async function recordLevel(
  character: LeveledCharacter,
): Promise<void> {
  try {
    await db.transactWrite({
      TransactItems: [
        {
          Put: {
            TableName: tableName,
            Item: mapLevelRecordToDynamoItem({
              userId: character.userId,
              characterName: character.name,
              level: character.level,
              recordedAt: character.updatedAt,
            }),
          },
        },
        {
          Put: {
            TableName: tableName,
            Item: mapCharacterToDynamoItem(character),
            ConditionExpression:
              'attribute_not_exists(#level) OR #level <= :level',
            ExpressionAttributeNames: { '#level': DynamoCharacterKeys.level },
            ExpressionAttributeValues: { ':level': character.level },
          },
        },
      ],
    });
  } catch (error) {
    if (
      error instanceof TransactionCanceledException &&
      error.CancellationReasons?.some(
        (reason) => reason.Code === 'ConditionalCheckFailed',
      )
    ) {
      throw new LevelDecreaseError();
    }
    throw error;
  }
}
