import { describe, it, expect } from 'vitest';

import type { CichDictValue } from 'applications/operationalStudies/types';
import type { TrainSchedule } from 'common/api/osrdEditoastApi';

import { buildSteps } from '../buildStepsFromOcp';
import findMostFrequentScheduleInPacedTrain from '../findMostFrequentXmlSchedule';
import { getMostFrequentInterval } from '../parseXML';

describe('buildSteps', () => {
  const parser = new DOMParser();
  const cichDict: Record<string, CichDictValue> = {
    STATION0: { ciCode: 1, chCode: 'A0' },
    STATION1: { ciCode: 12345, chCode: 'A1' },
    STATION2: { ciCode: 23456, chCode: 'B2' },
  };

  it('increments the day offset when the arrival time is before the previous departure', () => {
    const xmlSteps = `
        <root>
          <ocpTT ocpRef="STATION0" ocpType="stop">
            <times departure="00:00" />
          </ocpTT>
          <ocpTT ocpRef="STATION1" ocpType="stop">
            <times arrival="23:00" departure="23:05" />
          </ocpTT>
          <ocpTT ocpRef="STATION2" ocpType="stop">
            <times arrival="00:15" departure="00:20" />
          </ocpTT>
        </root>
      `;

    const xmlDoc = parser.parseFromString(xmlSteps, 'application/xml');

    const ocpTTElements = Array.from(xmlDoc.getElementsByTagName('ocpTT'));

    const { schedule } = buildSteps(ocpTTElements, cichDict, new Date('2025-01-01'));

    expect(schedule).toHaveLength(2);
    expect(schedule[0].arrival).toBe('PT23H');
    expect(schedule[0].stop_for).toBe('PT300S');
    expect(schedule[1].arrival).toBe('P1DT15M');
    expect(schedule[1].stop_for).toBe('PT300S');
  });
  it('does not increment the day offset when the arrival time is after the previous departure', () => {
    const xmlSteps = `  <root>
    <ocpTT ocpRef="STATION0" ocpType="stop">
      <times departure="00:00" />
    </ocpTT>
    <ocpTT ocpRef="STATION1" ocpType="stop">
      <times arrival="00:05" departure="00:10" />
    </ocpTT>
    <ocpTT ocpRef="STATION2" ocpType="stop">
      <times arrival="00:15" departure="00:20" />
    </ocpTT>
  </root>
`;
    const xmlDoc = parser.parseFromString(xmlSteps, 'application/xml');

    const ocpTTElements = Array.from(xmlDoc.getElementsByTagName('ocpTT'));

    const { schedule } = buildSteps(ocpTTElements, cichDict, new Date('2025-01-01'));

    expect(schedule).toHaveLength(2);
    expect(schedule[0].arrival).toBe('PT5M');
    expect(schedule[0].stop_for).toBe('PT300S');
    expect(schedule[1].arrival).toBe('PT15M');
    expect(schedule[1].stop_for).toBe('PT300S');
  });
});

function buildSchedule(id: string, timeOffsetSeconds: number = 0): TrainSchedule {
  const baseDate = new Date('2025-01-01T08:00:00');
  const departureDate = new Date(baseDate.getTime() + timeOffsetSeconds * 1000);

  return {
    train_name: id,
    rolling_stock_name: '27000US',
    start_time: departureDate.toISOString(),
    constraint_distribution: 'STANDARD',
    path: [
      {
        id: 'step1',
        uic: 1,
        trigram: 'TR1',
      },
      {
        id: 'step2',
        uic: 2,
        trigram: 'TR2',
      },
    ],
    schedule: [
      {
        at: 'step1',
        arrival: `PT${timeOffsetSeconds}S`,
        stop_for: 'PT60S',
      },
      {
        at: 'step2',
        arrival: `PT${timeOffsetSeconds + 300}S`,
        stop_for: 'PT60S',
      },
    ],
  };
}

describe('findMostFrequentScheduleInPacedTrain', () => {
  it('returns the most frequently occurring schedule', () => {
    const s1 = buildSchedule('s1');
    const s2 = buildSchedule('s2');
    const s3 = {
      ...buildSchedule('s3', 600), // different timing
    };

    const result = findMostFrequentScheduleInPacedTrain([s1, s2, s3]);

    expect(result.mostFrequent?.train_name).toBe('s1');
    expect(result.highestCount).toBe(2);
  });

  it('returns null and 0 if list is empty', () => {
    const result = findMostFrequentScheduleInPacedTrain([]);
    expect(result.mostFrequent).toBe(null);
    expect(result.highestCount).toBe(0);
  });

  it('only matches schedules if uic or trigram are the same at each step', () => {
    const s1 = buildSchedule('s1');
    const s2 = buildSchedule('s2');

    // s3 has same times but different uic and trigram — should not match
    const s3 = {
      ...buildSchedule('s3'),
      path: [
        {
          ...buildSchedule('s3').path[0],
          uic: 99,
          trigram: 'XXX',
        },
        {
          ...buildSchedule('s3').path[1],
          uic: 88,
          trigram: 'YYY',
        },
      ],
    };

    const result = findMostFrequentScheduleInPacedTrain([s1, s2, s3]);

    expect(result.mostFrequent?.train_name).toBe('s1');
    expect(result.highestCount).toBe(2);
  });
});

describe('getMostFrequentInterval', () => {
  it('returns 60 min when 60 and 120 are equally frequent', () => {
    const schedules: TrainSchedule[] = [
      buildSchedule('s1', 0),
      buildSchedule('s2', 3600),
      buildSchedule('s3', 10800),
      buildSchedule('s4', 14400),
      buildSchedule('s5', 21600),
    ];

    const result = getMostFrequentInterval(schedules);
    expect(result.total('minute')).toBe(60);
  });

  it('returns 120 if it’s the only frequent candidate', () => {
    const schedules = [
      buildSchedule('s1', 0),
      buildSchedule('s2', 7200),
      buildSchedule('s3', 14400),
    ];
    const result = getMostFrequentInterval(schedules);
    expect(result.total('minute')).toBe(120);
  });

  it('returns the greatest interval if no preferred match', () => {
    const schedules = [
      buildSchedule('s1', 0),
      buildSchedule('s2', 300),
      buildSchedule('s3', 600),
      buildSchedule('s4', 900),
      buildSchedule('s5', 2100),
    ];
    const result = getMostFrequentInterval(schedules);
    expect(result.total('minute')).toBe(5);
  });

  it('returns 30 if it is the most frequent', () => {
    const schedules = [
      buildSchedule('s1', 0),
      buildSchedule('s2', 1800),
      buildSchedule('s3', 3600),
      buildSchedule('s4', 7200),
    ];
    const result = getMostFrequentInterval(schedules);
    expect(result.total('minute')).toBe(30);
  });
});
