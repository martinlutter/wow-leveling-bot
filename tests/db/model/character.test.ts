import {
  type Character,
  hasLevel,
  mapCharacterToDynamoItem,
  mapDynamoItemToCharacter,
  toCharacterSk,
  toUserCharactersSkPrefix,
} from '../../../src/db/model/character';

const character: Character = {
  userId: '123',
  name: 'Grom Hellscream',
  level: 42,
  updatedAt: new Date('2026-09-27T07:00:00.000Z'),
};

describe('character model', () => {
  it('builds the sort key from the user ID and the lowercase name', () => {
    expect(toCharacterSk('123', 'Grom Hellscream')).toBe('123#grom hellscream');
  });

  it("builds a sort key prefix that matches the user's characters", () => {
    expect(toUserCharactersSkPrefix('123')).toBe('123#');
    expect(
      toCharacterSk('123', 'Grom').startsWith(toUserCharactersSkPrefix('123')),
    ).toBe(true);
  });

  it('maps a character to a Dynamo item', () => {
    expect(mapCharacterToDynamoItem(character)).toEqual({
      pk: 'CHARACTERS',
      sk: '123#grom hellscream',
      userId: '123',
      name: 'Grom Hellscream',
      level: 42,
      updatedAt: '2026-09-27T07:00:00.000Z',
    });
  });

  it('round-trips through a Dynamo item', () => {
    expect(
      mapDynamoItemToCharacter(mapCharacterToDynamoItem(character)),
    ).toEqual(character);
  });

  it('maps a character without a level, leaving the attributes out', () => {
    const added: Character = { userId: '123', name: 'Grom' };

    expect(mapCharacterToDynamoItem(added)).toEqual({
      pk: 'CHARACTERS',
      sk: '123#grom',
      userId: '123',
      name: 'Grom',
      level: undefined,
      updatedAt: undefined,
    });
    expect(mapDynamoItemToCharacter(mapCharacterToDynamoItem(added))).toEqual(
      added,
    );
  });

  it('tells whether a character has a level', () => {
    expect(hasLevel(character)).toBe(true);
    expect(hasLevel({ userId: '123', name: 'Grom' })).toBe(false);
  });
});
