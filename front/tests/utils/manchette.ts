import { expect } from '@playwright/test';

import { readJsonFile } from './file-utils';
import type { TimetableFilterTranslations } from './types';
const frScenarioTranslations: TimetableFilterTranslations = readJsonFile<{
  main: TimetableFilterTranslations;
}>('public/locales/fr/operational-studies.json').main;

export type Waypoint = {
  name: string;
  ch: string | undefined;
  offset: string;
  checked?: boolean;
};

export function requestedPoint(number: string): string {
  return frScenarioTranslations.requestedPoint.replaceAll('{{ count }}', number);
}

export function verifyWaypointsData(
  actualWaypoints: Waypoint[],
  expectedWaypoints: Record<string, Partial<Waypoint>>
): void {
  const actualNames = actualWaypoints.map((w) => w.name);
  expect(new Set(actualNames)).toEqual(new Set(Object.keys(expectedWaypoints)));

  expect(actualWaypoints).toHaveLength(Object.keys(expectedWaypoints).length);
  for (const wp of actualWaypoints) {
    const expected = expectedWaypoints[wp.name];
    expect(expected).toBeTruthy();
    if (wp.ch) expect(wp.ch).toBe(expected.ch);
    expect(wp.offset).toBe(expected.offset);
    if (wp.checked) expect(wp.checked).toBe(expected.checked);
  }
}
