import createAttributeNames from '../../util/createAttributeNames';
import { toCharacterSk } from './character';

export interface LevelRecord {
  userId: string;
  characterName: string;
  level: number;
  recordedAt: Date;
}

export interface DynamoLevelRecord {
  readonly pk: string; // RECORD#{userId}#{lowercase character name}
  readonly sk: string; // ISO timestamp of the record
  readonly level: number;
}

export const DynamoLevelRecordKeys = createAttributeNames<DynamoLevelRecord>();

export const toLevelRecordPk = (userId: string, characterName: string) =>
  `RECORD#${toCharacterSk(userId, characterName)}`;

// ISO timestamps have a fixed width, so they sort chronologically as strings
export const toLevelRecordSk = (recordedAt: Date) => recordedAt.toISOString();

export const mapLevelRecordToDynamoItem = (
  record: LevelRecord,
): DynamoLevelRecord => ({
  pk: toLevelRecordPk(record.userId, record.characterName),
  sk: toLevelRecordSk(record.recordedAt),
  level: record.level,
});
