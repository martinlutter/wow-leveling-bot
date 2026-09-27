import getFirstRecord from '../../src/db/getFirstRecord';

const mockQuery = jest.fn();
jest.mock('../../src/clients/db', () => ({
  db: { query: (...args: unknown[]): unknown => mockQuery(...args) },
}));
jest.mock('../../src/db/constants', () => ({ tableName: 'table' }));

const character = { userId: '123', name: 'Grom Hellscream' };

describe('getFirstRecord', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("queries the character's oldest record", async () => {
    mockQuery.mockResolvedValue({
      Items: [
        {
          pk: 'RECORD#123#grom hellscream',
          sk: '2026-09-20T12:00:00.000Z',
          level: 10,
        },
      ],
    });

    const record = await getFirstRecord(character);

    expect(mockQuery).toHaveBeenCalledWith({
      TableName: 'table',
      KeyConditionExpression: '#pk = :pk',
      ExpressionAttributeNames: { '#pk': 'pk' },
      ExpressionAttributeValues: { ':pk': 'RECORD#123#grom hellscream' },
      ScanIndexForward: true,
      Limit: 1,
    });
    expect(record).toEqual({
      level: 10,
      recordedAt: new Date('2026-09-20T12:00:00.000Z'),
    });
  });

  it('returns undefined when the character has no record', async () => {
    mockQuery.mockResolvedValue({ Items: [] });

    expect(await getFirstRecord(character)).toBeUndefined();
  });
});
