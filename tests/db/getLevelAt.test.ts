import getLevelAt from '../../src/db/getLevelAt';

const mockQuery = jest.fn();
jest.mock('../../src/clients/db', () => ({
  db: { query: (...args: unknown[]): unknown => mockQuery(...args) },
}));
jest.mock('../../src/db/constants', () => ({ tableName: 'table' }));

const character = { userId: '123', name: 'Grom Hellscream' };
const at = new Date('2026-09-26T07:00:00.000Z');

describe('getLevelAt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('queries the newest record at or before the time', async () => {
    mockQuery.mockResolvedValue({
      Items: [
        {
          pk: 'RECORD#123#grom hellscream',
          sk: '2026-09-25T20:00:00.000Z',
          level: 40,
        },
      ],
    });

    const level = await getLevelAt(character, at);

    expect(mockQuery).toHaveBeenCalledWith({
      TableName: 'table',
      KeyConditionExpression: '#pk = :pk AND #sk <= :sk',
      ExpressionAttributeNames: { '#pk': 'pk', '#sk': 'sk' },
      ExpressionAttributeValues: {
        ':pk': 'RECORD#123#grom hellscream',
        ':sk': '2026-09-26T07:00:00.000Z',
      },
      ScanIndexForward: false,
      Limit: 1,
    });
    expect(level).toBe(40);
  });

  it('returns undefined when the character had no record yet', async () => {
    mockQuery.mockResolvedValue({ Items: [] });

    expect(await getLevelAt(character, at)).toBeUndefined();
  });
});
