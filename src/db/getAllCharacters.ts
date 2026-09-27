import { db } from '../clients/db';
import { tableName } from './constants';
import {
  type Character,
  characterPk,
  type DynamoCharacter,
  DynamoCharacterKeys,
  mapDynamoItemToCharacter,
} from './model/character';

export default async function getAllCharacters(): Promise<Character[]> {
  const { Items = [] } = await db.query({
    TableName: tableName,
    KeyConditionExpression: '#pk = :pk',
    ExpressionAttributeNames: { '#pk': DynamoCharacterKeys.pk },
    ExpressionAttributeValues: { ':pk': characterPk },
  });

  return (Items as DynamoCharacter[]).map(mapDynamoItemToCharacter);
}
