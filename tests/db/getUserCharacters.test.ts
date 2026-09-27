import getUserCharacters from '../../src/db/getUserCharacters';

const mockQuery = jest.fn();
jest.mock('../../src/clients/db', () => ({
  db: { query: (...args: unknown[]): unknown => mockQuery(...args) },
}));
jest.mock('../../src/db/constants', () => ({ tableName: 'table' }));

describe('getUserCharacters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("queries the user's characters and maps them", async () => {
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

    const characters = await getUserCharacters('123');

    expect(mockQuery).toHaveBeenCalledWith({
      TableName: 'table',
      KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :skPrefix)',
      ExpressionAttributeNames: { '#pk': 'pk', '#sk': 'sk' },
      ExpressionAttributeValues: { ':pk': 'CHARACTERS', ':skPrefix': '123#' },
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

  it('returns an empty list when the user has no characters', async () => {
    mockQuery.mockResolvedValue({});

    expect(await getUserCharacters('123')).toEqual([]);
  });
});
