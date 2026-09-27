import deleteCharacter from '../../src/db/deleteCharacter';

const mockDelete = jest.fn();
const mockQuery = jest.fn();
const mockBatchWrite = jest.fn();
jest.mock('../../src/clients/db', () => ({
  db: {
    delete: (...args: unknown[]): unknown => mockDelete(...args),
    query: (...args: unknown[]): unknown => mockQuery(...args),
    batchWrite: (...args: unknown[]): unknown => mockBatchWrite(...args),
  },
}));
jest.mock('../../src/db/constants', () => ({ tableName: 'table' }));

const pk = 'RECORD#123#grom hellscream';
const recordKeys = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => ({ pk, sk: `sk${from + i}` }));
const deleteRequests = (keys: { pk: string; sk: string }[]) => ({
  RequestItems: { table: keys.map((Key) => ({ DeleteRequest: { Key } })) },
});

describe('deleteCharacter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDelete.mockResolvedValue({});
    mockBatchWrite.mockResolvedValue({});
  });

  it('deletes the character, then its records in batches of 25 across pages', async () => {
    mockQuery
      .mockResolvedValueOnce({
        Items: recordKeys(0, 30),
        LastEvaluatedKey: { pk, sk: 'sk29' },
      })
      .mockResolvedValueOnce({ Items: recordKeys(30, 2) });

    await deleteCharacter('123', 'Grom Hellscream');

    expect(mockDelete).toHaveBeenCalledWith({
      TableName: 'table',
      Key: { pk: 'CHARACTERS', sk: '123#grom hellscream' },
    });
    const query = {
      TableName: 'table',
      KeyConditionExpression: '#pk = :pk',
      ExpressionAttributeNames: { '#pk': 'pk', '#sk': 'sk' },
      ExpressionAttributeValues: { ':pk': pk },
      ProjectionExpression: '#pk, #sk',
    };
    expect(mockQuery).toHaveBeenNthCalledWith(1, {
      ...query,
      ExclusiveStartKey: undefined,
    });
    expect(mockQuery).toHaveBeenNthCalledWith(2, {
      ...query,
      ExclusiveStartKey: { pk, sk: 'sk29' },
    });
    expect(mockBatchWrite.mock.calls).toEqual([
      [deleteRequests(recordKeys(0, 25))],
      [deleteRequests(recordKeys(25, 5))],
      [deleteRequests(recordKeys(30, 2))],
    ]);
    expect(mockDelete.mock.invocationCallOrder[0]).toBeLessThan(
      mockQuery.mock.invocationCallOrder[0],
    );
  });

  it('retries unprocessed items', async () => {
    const keys = recordKeys(0, 3);
    mockQuery.mockResolvedValue({ Items: keys });
    mockBatchWrite
      .mockResolvedValueOnce({
        UnprocessedItems: deleteRequests([keys[2]]).RequestItems,
      })
      .mockResolvedValueOnce({ UnprocessedItems: {} });

    await deleteCharacter('123', 'Grom Hellscream');

    expect(mockBatchWrite.mock.calls).toEqual([
      [deleteRequests(keys)],
      [deleteRequests([keys[2]])],
    ]);
  });

  it("doesn't batch write when the character has no records", async () => {
    mockQuery.mockResolvedValue({ Items: [] });

    await deleteCharacter('123', 'Grom Hellscream');

    expect(mockDelete).toHaveBeenCalled();
    expect(mockBatchWrite).not.toHaveBeenCalled();
  });
});
