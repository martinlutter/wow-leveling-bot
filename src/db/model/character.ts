import createAttributeNames from '../../util/createAttributeNames';

export interface Character {
  userId: string;
  name: string; // casing as first typed
  level?: number; // unset until the first /level
  updatedAt?: Date; // of the last /level
}

export type LeveledCharacter = Required<Character>;

export const hasLevel = (character: Character): character is LeveledCharacter =>
  character.level !== undefined;

export interface DynamoCharacter {
  readonly pk: string; // CHARACTERS
  readonly sk: string; // {userId}#{lowercase name}
  readonly userId: string;
  readonly name: string;
  readonly level?: number;
  readonly updatedAt?: string; // ISO timestamp
}

export const DynamoCharacterKeys = createAttributeNames<DynamoCharacter>();

export const characterPk = 'CHARACTERS';

// User IDs never contain '#', so this prefix matches exactly one user's characters
export const toUserCharactersSkPrefix = (userId: string) => `${userId}#`;

export const toCharacterSk = (userId: string, name: string) =>
  `${toUserCharactersSkPrefix(userId)}${name.toLowerCase()}`;

export const mapCharacterToDynamoItem = (
  character: Character,
): DynamoCharacter => ({
  pk: characterPk,
  sk: toCharacterSk(character.userId, character.name),
  userId: character.userId,
  name: character.name,
  level: character.level,
  updatedAt: character.updatedAt?.toISOString(),
});

export const mapDynamoItemToCharacter = (item: DynamoCharacter): Character => ({
  userId: item.userId,
  name: item.name,
  level: item.level,
  updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined,
});
