import { db } from '../clients/db';
import { tableName } from './constants';
import { characterPk, toCharacterSk } from './model/character';
import {
  type DynamoLevelRecord,
  DynamoLevelRecordKeys,
  toLevelRecordPk,
} from './model/levelRecord';

const BATCH_WRITE_LIMIT = 25;

/** Deletes a user's character and its whole level history. Deleting a missing character is a no-op. */
export default async function deleteCharacter(
  userId: string,
  name: string,
): Promise<void> {
  // The character first, so it disappears even if deleting the history fails midway
  await db.delete({
    TableName: tableName,
    Key: { pk: characterPk, sk: toCharacterSk(userId, name) },
  });

  let exclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const { Items = [], LastEvaluatedKey } = await db.query({
      TableName: tableName,
      KeyConditionExpression: '#pk = :pk',
      ExpressionAttributeNames: {
        '#pk': DynamoLevelRecordKeys.pk,
        '#sk': DynamoLevelRecordKeys.sk,
      },
      ExpressionAttributeValues: { ':pk': toLevelRecordPk(userId, name) },
      ProjectionExpression: '#pk, #sk',
      ExclusiveStartKey: exclusiveStartKey,
    });
    await deleteItems(Items as Pick<DynamoLevelRecord, 'pk' | 'sk'>[]);
    exclusiveStartKey = LastEvaluatedKey;
  } while (exclusiveStartKey);
}

async function deleteItems(keys: Pick<DynamoLevelRecord, 'pk' | 'sk'>[]) {
  for (let i = 0; i < keys.length; i += BATCH_WRITE_LIMIT) {
    let requests = keys
      .slice(i, i + BATCH_WRITE_LIMIT)
      .map((key) => ({ DeleteRequest: { Key: key } }));
    // DynamoDB may leave some items unprocessed under load: retry them
    while (requests.length) {
      const { UnprocessedItems } = await db.batchWrite({
        RequestItems: { [tableName]: requests },
      });
      requests = (UnprocessedItems?.[tableName] ?? []) as typeof requests;
    }
  }
}
