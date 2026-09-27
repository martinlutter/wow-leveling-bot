import {
  mapLevelRecordToDynamoItem,
  toLevelRecordPk,
  toLevelRecordSk,
} from '../../../src/db/model/levelRecord';

describe('level record model', () => {
  it('builds the partition key from the user ID and the lowercase character name', () => {
    expect(toLevelRecordPk('123', 'Grom Hellscream')).toBe(
      'RECORD#123#grom hellscream',
    );
  });

  it('builds the sort key from the ISO timestamp', () => {
    expect(toLevelRecordSk(new Date('2026-09-27T07:00:00.000Z'))).toBe(
      '2026-09-27T07:00:00.000Z',
    );
  });

  it('builds sort keys that sort chronologically as strings', () => {
    const earlier = toLevelRecordSk(new Date('2026-09-09T23:59:59.999Z'));
    const later = toLevelRecordSk(new Date('2026-09-10T00:00:00.000Z'));

    expect(earlier < later).toBe(true);
  });

  it('maps a level record to a Dynamo item', () => {
    expect(
      mapLevelRecordToDynamoItem({
        userId: '123',
        characterName: 'Grom',
        level: 7,
        recordedAt: new Date('2026-09-27T07:00:00.000Z'),
      }),
    ).toEqual({
      pk: 'RECORD#123#grom',
      sk: '2026-09-27T07:00:00.000Z',
      level: 7,
    });
  });
});
