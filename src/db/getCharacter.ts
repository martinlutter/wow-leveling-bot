import { db } from '../clients/db';
import { tableName } from './constants';
import {
  type Character,
  characterPk,
  type DynamoCharacter,
  mapDynamoItemToCharacter,
  toCharacterSk,
} from './model/character';

/** Finds a user's character by name, case-insensitively. */
export default async function getCharacter(
  userId: string,
  name: string,
): Promise<Character | undefined> {
  const { Item } = await db.get({
    TableName: tableName,
    Key: { pk: characterPk, sk: toCharacterSk(userId, name) },
  });

  return Item ? mapDynamoItemToCharacter(Item as DynamoCharacter) : undefined;
}
