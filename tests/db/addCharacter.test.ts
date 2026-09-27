import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import addCharacter, { CharacterExistsError } from '../../src/db/addCharacter';

const mockPut = jest.fn();
jest.mock('../../src/clients/db', () => ({
  db: { put: (...args: unknown[]): unknown => mockPut(...args) },
}));
jest.mock('../../src/db/constants', () => ({ tableName: 'table' }));

describe('addCharacter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('puts a character without a level unless it exists', async () => {
    mockPut.mockResolvedValue({});

    await addCharacter('123', 'Grom Hellscream');

    expect(mockPut).toHaveBeenCalledWith({
      TableName: 'table',
      Item: {
        pk: 'CHARACTERS',
        sk: '123#grom hellscream',
        userId: '123',
        name: 'Grom Hellscream',
      },
      ConditionExpression: 'attribute_not_exists(#pk)',
      ExpressionAttributeNames: { '#pk': 'pk' },
    });
  });

  it('throws CharacterExistsError when the character exists', async () => {
    mockPut.mockRejectedValue(
      new ConditionalCheckFailedException({ message: 'exists', $metadata: {} }),
    );

    await expect(addCharacter('123', 'Grom')).rejects.toBeInstanceOf(
      CharacterExistsError,
    );
  });

  it('rethrows other errors', async () => {
    const error = new Error('boom');
    mockPut.mockRejectedValue(error);

    await expect(addCharacter('123', 'Grom')).rejects.toBe(error);
  });
});
