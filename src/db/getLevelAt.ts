import { db } from '../clients/db';
import { tableName } from './constants';
import { type Character } from './model/character';
import {
  type DynamoLevelRecord,
  DynamoLevelRecordKeys,
  toLevelRecordPk,
  toLevelRecordSk,
} from './model/levelRecord';

/** The character's level at `at`, or undefined if it had no record yet. */
export default async function getLevelAt(
  character: Pick<Character, 'userId' | 'name'>,
  at: Date,
): Promise<number | undefined> {
  const { Items = [] } = await db.query({
    TableName: tableName,
    KeyConditionExpression: '#pk = :pk AND #sk <= :sk',
    ExpressionAttributeNames: {
      '#pk': DynamoLevelRecordKeys.pk,
      '#sk': DynamoLevelRecordKeys.sk,
    },
    ExpressionAttributeValues: {
      ':pk': toLevelRecordPk(character.userId, character.name),
      ':sk': toLevelRecordSk(at),
    },
    ScanIndexForward: false,
    Limit: 1,
  });

  return (Items[0] as DynamoLevelRecord | undefined)?.level;
}
