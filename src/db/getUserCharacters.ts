import { db } from '../clients/db';
import { tableName } from './constants';
import {
  type Character,
  characterPk,
  type DynamoCharacter,
  DynamoCharacterKeys,
  mapDynamoItemToCharacter,
  toUserCharactersSkPrefix,
} from './model/character';

export default async function getUserCharacters(
  userId: string,
): Promise<Character[]> {
  const { Items = [] } = await db.query({
    TableName: tableName,
    KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :skPrefix)',
    ExpressionAttributeNames: {
      '#pk': DynamoCharacterKeys.pk,
      '#sk': DynamoCharacterKeys.sk,
    },
    ExpressionAttributeValues: {
      ':pk': characterPk,
      ':skPrefix': toUserCharactersSkPrefix(userId),
    },
  });

  return (Items as DynamoCharacter[]).map(mapDynamoItemToCharacter);
}
