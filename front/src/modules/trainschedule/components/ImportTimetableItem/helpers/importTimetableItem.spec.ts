import { describe, it, expect } from 'vitest';

import type { CichDictValue, Step } from 'applications/operationalStudies/types';

import { buildSteps } from './buildStepsFromOcp';

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

    const steps: Step[] = buildSteps(ocpTTElements, cichDict, '2025-01-01');

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

    const steps: Step[] = buildSteps(ocpTTElements, cichDict, '2025-01-01');

    expect(steps).toHaveLength(2);
    expect(steps[0].arrivalTime).toBe('2025-01-01 00:05');
    expect(steps[0].departureTime).toBe('2025-01-01 00:10');
    expect(steps[1].arrivalTime).toBe('2025-01-01 00:15');
    expect(steps[1].departureTime).toBe('2025-01-01 00:20');
  });
});
