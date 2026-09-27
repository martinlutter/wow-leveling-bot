import { db } from '../clients/db';
import { tableName } from './constants';
import { type Character } from './model/character';
import {
  type DynamoLevelRecord,
  DynamoLevelRecordKeys,
  type LevelRecord,
  toLevelRecordPk,
} from './model/levelRecord';

/** The character's oldest record, or undefined if it has none. */
export default async function getFirstRecord(
  character: Pick<Character, 'userId' | 'name'>,
): Promise<Pick<LevelRecord, 'level' | 'recordedAt'> | undefined> {
  const { Items = [] } = await db.query({
    TableName: tableName,
    KeyConditionExpression: '#pk = :pk',
    ExpressionAttributeNames: { '#pk': DynamoLevelRecordKeys.pk },
    ExpressionAttributeValues: {
      ':pk': toLevelRecordPk(character.userId, character.name),
    },
    ScanIndexForward: true,
    Limit: 1,
  });

  const item = Items[0] as DynamoLevelRecord | undefined;
  return item && { level: item.level, recordedAt: new Date(item.sk) };
}
