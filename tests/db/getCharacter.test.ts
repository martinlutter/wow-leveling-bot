import getCharacter from '../../src/db/getCharacter';

const mockGet = jest.fn();
jest.mock('../../src/clients/db', () => ({
  db: { get: (...args: unknown[]): unknown => mockGet(...args) },
}));
jest.mock('../../src/db/constants', () => ({ tableName: 'table' }));

describe('getCharacter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('gets the character by its case-insensitive key and maps it', async () => {
    mockGet.mockResolvedValue({
      Item: { pk: 'CHARACTERS', sk: '123#grom', userId: '123', name: 'Grom' },
    });

    const character = await getCharacter('123', 'GROM');

    expect(mockGet).toHaveBeenCalledWith({
      TableName: 'table',
      Key: { pk: 'CHARACTERS', sk: '123#grom' },
    });
    expect(character).toEqual({ userId: '123', name: 'Grom' });
  });

  it("returns undefined when the user doesn't have the character", async () => {
    mockGet.mockResolvedValue({});

    expect(await getCharacter('123', 'Grom')).toBeUndefined();
  });
});
