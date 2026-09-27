import { type LeveledCharacter } from './db/model/character';
import { type LevelRecord } from './db/model/levelRecord';

export const MAX_LEVEL = 60;
export const STALE_AFTER_DAYS = 3;
export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Levels per day from the first record to the latest one, or undefined when they're less than a day apart (which
 * includes a single record).
 */
export function getPace(
  character: Pick<LeveledCharacter, 'level' | 'updatedAt'>,
  firstRecord: Pick<LevelRecord, 'level' | 'recordedAt'> | undefined,
): number | undefined {
  if (!firstRecord) {
    return undefined;
  }
  const days =
    (character.updatedAt.getTime() - firstRecord.recordedAt.getTime()) / DAY_MS;
  return days < 1 ? undefined : (character.level - firstRecord.level) / days;
}

/** Whole days to reach max level at `pace`, or undefined at max level or without progress. */
export function getEtaDays(
  level: number,
  pace: number | undefined,
): number | undefined {
  if (level >= MAX_LEVEL || !pace) {
    return undefined;
  }
  return Math.ceil((MAX_LEVEL - level) / pace);
}

/** No update for a while. A character at max level is done, not stale. */
export const isStale = (
  character: Pick<LeveledCharacter, 'level' | 'updatedAt'>,
  now: Date,
) =>
  character.level < MAX_LEVEL &&
  now.getTime() - character.updatedAt.getTime() > STALE_AFTER_DAYS * DAY_MS;

export const formatPace = (pace: number) => `${pace.toFixed(1)}/day`;
