import {
  formatPace,
  getEtaDays,
  getPace,
  isStale,
  MAX_LEVEL,
} from '../src/leveling';

const firstRecord = {
  level: 10,
  recordedAt: new Date('2026-09-20T12:00:00.000Z'),
};

describe('getPace', () => {
  it('is levels per day from the first record to the latest one', () => {
    const pace = getPace(
      { level: 25, updatedAt: new Date('2026-09-30T12:00:00.000Z') },
      firstRecord,
    );

    expect(pace).toBe(1.5);
  });

  it('is undefined without a first record', () => {
    expect(
      getPace({ level: 25, updatedAt: new Date() }, undefined),
    ).toBeUndefined();
  });

  it('is undefined for a single record', () => {
    expect(
      getPace({ level: 10, updatedAt: firstRecord.recordedAt }, firstRecord),
    ).toBeUndefined();
  });

  it('is undefined for records less than a day apart', () => {
    const pace = getPace(
      { level: 14, updatedAt: new Date('2026-09-21T11:59:59.999Z') },
      firstRecord,
    );

    expect(pace).toBeUndefined();
  });

  it('is 0 when a later record repeats the first level', () => {
    const pace = getPace(
      { level: 10, updatedAt: new Date('2026-09-22T12:00:00.000Z') },
      firstRecord,
    );

    expect(pace).toBe(0);
  });
});

describe('getEtaDays', () => {
  it('rounds the days to max level up', () => {
    expect(getEtaDays(50, 3)).toBe(4);
  });

  it('is undefined without a pace or with a pace of 0', () => {
    expect(getEtaDays(50, undefined)).toBeUndefined();
    expect(getEtaDays(50, 0)).toBeUndefined();
  });

  it('is undefined at max level', () => {
    expect(getEtaDays(MAX_LEVEL, 2)).toBeUndefined();
  });
});

describe('isStale', () => {
  const now = new Date('2026-09-27T05:00:00.000Z');

  it('is true after 3 days without an update', () => {
    expect(
      isStale(
        { level: 30, updatedAt: new Date('2026-09-24T04:59:59.999Z') },
        now,
      ),
    ).toBe(true);
  });

  it('is false within 3 days', () => {
    expect(
      isStale(
        { level: 30, updatedAt: new Date('2026-09-24T05:00:00.000Z') },
        now,
      ),
    ).toBe(false);
  });

  it('is false at max level', () => {
    expect(
      isStale({ level: MAX_LEVEL, updatedAt: new Date('2026-01-01') }, now),
    ).toBe(false);
  });
});

describe('formatPace', () => {
  it('shows one decimal', () => {
    expect(formatPace(1.25)).toBe('1.3/day');
    expect(formatPace(2)).toBe('2.0/day');
  });
});
