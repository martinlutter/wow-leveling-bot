import getAllCharacters from '../../src/db/getAllCharacters';

const mockQuery = jest.fn();
jest.mock('../../src/clients/db', () => ({
  db: { query: (...args: unknown[]): unknown => mockQuery(...args) },
}));
jest.mock('../../src/db/constants', () => ({ tableName: 'table' }));

describe('getAllCharacters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('queries all characters and maps them', async () => {
    mockQuery.mockResolvedValue({
      Items: [
        {
          pk: 'CHARACTERS',
          sk: '123#grom',
          userId: '123',
          name: 'Grom',
          level: 42,
          updatedAt: '2026-09-27T07:00:00.000Z',
        },
      ],
    });

    const characters = await getAllCharacters();

    expect(mockQuery).toHaveBeenCalledWith({
      TableName: 'table',
      KeyConditionExpression: '#pk = :pk',
      ExpressionAttributeNames: { '#pk': 'pk' },
      ExpressionAttributeValues: { ':pk': 'CHARACTERS' },
    });
    expect(characters).toEqual([
      {
        userId: '123',
        name: 'Grom',
        level: 42,
        updatedAt: new Date('2026-09-27T07:00:00.000Z'),
      },
    ]);
  });

  it('returns an empty list when nobody has a character', async () => {
    mockQuery.mockResolvedValue({});

    expect(await getAllCharacters()).toEqual([]);
  });
});
