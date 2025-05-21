import { describe, it, expect } from 'vitest';

import type { CichDictValue, ImportedTrainSchedule } from 'applications/operationalStudies/types';

import { buildSteps } from '../buildStepsFromOcp';
import { findMostFrequentScheduleInPacedTrain } from '../findMostFrequentXmlSchedule';

describe('buildSteps', () => {
  const parser = new DOMParser();
  const cichDict: Record<string, CichDictValue> = {
    STATION1: { ciCode: 12345, chCode: 'A1' },
    STATION2: { ciCode: 23456, chCode: 'B2' },
  };

  it('increments the day offset when the arrival time is before the previous departure', () => {
    const xmlSteps = `
        <root>
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

    const steps = buildSteps(ocpTTElements, cichDict, '2025-01-01');

    expect(steps).toHaveLength(2);
    expect(steps[0].arrivalTime).toBe('2025-01-01 23:00');
    expect(steps[0].departureTime).toBe('2025-01-01 23:05');
    expect(steps[1].arrivalTime).toBe('2025-01-02 00:15');
    expect(steps[1].departureTime).toBe('2025-01-02 00:20');
  });
  it('does not increment the day offset when the arrival time is after the previous departure', () => {
    const xmlSteps = `  <root>
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

    const steps = buildSteps(ocpTTElements, cichDict, '2025-01-01');

    expect(steps).toHaveLength(2);
    expect(steps[0].arrivalTime).toBe('2025-01-01 00:05');
    expect(steps[0].departureTime).toBe('2025-01-01 00:10');
    expect(steps[1].arrivalTime).toBe('2025-01-01 00:15');
    expect(steps[1].departureTime).toBe('2025-01-01 00:20');
  });
});

function buildSchedule(id: string, timeOffsetSeconds: number = 0): ImportedTrainSchedule {
  const baseDate = new Date('2025-01-01T08:00:00');

  return {
    trainNumber: id,
    rollingStock: '27000US',
    departureTime: baseDate.toISOString(),
    arrivalTime: new Date(baseDate.getTime() + 600000).toISOString(),
    departure: '',
    steps: [
      {
        name: 'A',
        uic: 1,
        trigram: 'TR1',
        latitude: 0,
        longitude: 0,
        arrivalTime: new Date(baseDate.getTime() + timeOffsetSeconds * 1000).toISOString(),
        departureTime: new Date(baseDate.getTime() + (timeOffsetSeconds + 60) * 1000).toISOString(),
      },
      {
        name: 'B',
        uic: 2,
        trigram: 'TR2',
        latitude: 0,
        longitude: 0,
        arrivalTime: new Date(baseDate.getTime() + (timeOffsetSeconds + 300) * 1000).toISOString(),
        departureTime: new Date(
          baseDate.getTime() + (timeOffsetSeconds + 360) * 1000
        ).toISOString(),
      },
    ],
  };
}

describe('findMostFrequentScheduleInPacedTrain', () => {
  it('returns the most frequently occurring schedule', () => {
    const s1 = buildSchedule('s1');
    const s2 = buildSchedule('s2');
    const s3 = buildSchedule('s3', 10); // different timing

    const result = findMostFrequentScheduleInPacedTrain([s1, s2, s3]);

    expect(result.mostFrequent?.trainNumber).toBe('s1');
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
      steps: [
        {
          ...buildSchedule('s3').steps[0],
          uic: 99,
          trigram: 'XXX',
        },
        {
          ...buildSchedule('s3').steps[1],
          uic: 88,
          trigram: 'YYY',
        },
      ],
    };

    const result = findMostFrequentScheduleInPacedTrain([s1, s2, s3]);

    expect(result.mostFrequent?.trainNumber).toBe('s1');
    expect(result.highestCount).toBe(2);
  });
});
