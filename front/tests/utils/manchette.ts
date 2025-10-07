import { expect } from '@playwright/test';

import readJsonFile from './file-utils';
import type { TimetableFilterTranslations } from './types';
const frScenarioTranslations: TimetableFilterTranslations = readJsonFile<{
  main: TimetableFilterTranslations;
}>('public/locales/fr/operational-studies.json').main;

export type Waypoint = {
  name: string;
  ch: string;
  offset: string;
  checked?: boolean;
};

const requestedDestination = frScenarioTranslations.requestedDestination;

function requestedPoint(number: string): string {
  return frScenarioTranslations.requestedPoint.replaceAll('{{ count }}', number);
}

export const expectedWaypointsPanelDataForTrainSchedule: Record<string, Partial<Waypoint>> = {
  North_East_station: { ch: 'BV', offset: '0.0', checked: true },
  Mid_East_station: { ch: 'BV', offset: '19.55', checked: true },
  [requestedPoint('2')]: { ch: '', offset: '22.47', checked: true },
  Mid_West_station: { ch: 'BV', offset: '34.0', checked: true },
  North_West_station: { ch: 'BC', offset: '47.55', checked: true },
};

export const expectedWaypointsPanelDataForPacedTrain: Record<string, Partial<Waypoint>> = {
  North_East_station: { ch: 'BV', offset: '0.0', checked: true },
  Mid_East_station: { ch: 'BV', offset: '19.55', checked: true },
  [requestedPoint('1')]: { ch: '', offset: '22.47', checked: true },
  Mid_West_station: { ch: 'BV', offset: '34.0', checked: true },
  North_West_station: { ch: 'BV', offset: '47.60', checked: true },
  [requestedDestination]: { ch: '', offset: '47.65', checked: true },
};

export const expectedWaypointsListDataForPacedTrain: Record<string, Partial<Waypoint>> = {
  North_East_station: { ch: 'BV', offset: '0' },
  [requestedPoint('1')]: { ch: '', offset: '22.5' },
  Mid_West_station: { ch: 'BV', offset: '34' },
  [requestedDestination]: { ch: '', offset: '47.7' },
};

export const expectedWaypointsListDataForTrainSchedule: Record<string, Partial<Waypoint>> = {
  North_East_station: { ch: 'BV', offset: '0' },
  Mid_East_station: { ch: 'BV', offset: '19.6' },
  Mid_West_station: { ch: 'BV', offset: '34' },
  North_West_station: { ch: 'BC', offset: '47.6' },
};

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
    expect(wp.ch).toBe(expected.ch);
    expect(wp.offset).toBe(expected.offset);
    if (wp.checked) expect(wp.checked).toBe(expected.checked);
  }
}
