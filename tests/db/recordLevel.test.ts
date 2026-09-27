import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import recordLevel, { LevelDecreaseError } from '../../src/db/recordLevel';

const mockTransactWrite = jest.fn();
jest.mock('../../src/clients/db', () => ({
  db: {
    transactWrite: (...args: unknown[]): unknown => mockTransactWrite(...args),
  },
}));
jest.mock('../../src/db/constants', () => ({ tableName: 'table' }));

const character = {
  userId: '123',
  name: 'Grom Hellscream',
  level: 42,
  updatedAt: new Date('2026-09-27T07:00:00.000Z'),
};

function cancelledTransaction(codes: string[]): TransactionCanceledException {
  return new TransactionCanceledException({
    message: 'Transaction cancelled',
    $metadata: {},
    CancellationReasons: codes.map((Code) => ({ Code })),
  });
}

describe('recordLevel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('writes the record and the character, refusing a lower level but not a first one', async () => {
    mockTransactWrite.mockResolvedValue({});

    await recordLevel(character);

    expect(mockTransactWrite).toHaveBeenCalledWith({
      TransactItems: [
        {
          Put: {
            TableName: 'table',
            Item: {
              pk: 'RECORD#123#grom hellscream',
              sk: '2026-09-27T07:00:00.000Z',
              level: 42,
            },
          },
        },
        {
          Put: {
            TableName: 'table',
            Item: {
              pk: 'CHARACTERS',
              sk: '123#grom hellscream',
              userId: '123',
              name: 'Grom Hellscream',
              level: 42,
              updatedAt: '2026-09-27T07:00:00.000Z',
            },
            ConditionExpression:
              'attribute_not_exists(#level) OR #level <= :level',
            ExpressionAttributeNames: { '#level': 'level' },
            ExpressionAttributeValues: { ':level': 42 },
          },
        },
      ],
    });
  });

  it('throws LevelDecreaseError when the condition fails', async () => {
    mockTransactWrite.mockRejectedValue(
      cancelledTransaction(['None', 'ConditionalCheckFailed']),
    );

    await expect(recordLevel(character)).rejects.toBeInstanceOf(
      LevelDecreaseError,
    );
  });

  it('rethrows a transaction cancelled for another reason', async () => {
    const error = cancelledTransaction(['TransactionConflict', 'None']);
    mockTransactWrite.mockRejectedValue(error);

    await expect(recordLevel(character)).rejects.toBe(error);
  });

  it('rethrows other errors', async () => {
    const error = new Error('boom');
    mockTransactWrite.mockRejectedValue(error);

    await expect(recordLevel(character)).rejects.toBe(error);
  });
});
