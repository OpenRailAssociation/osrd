import { readJsonFile } from '../../utils/file-utils';
import { requestedPoint, type Waypoint } from '../../utils/manchette';
import type { TimetableFilterTranslations } from '../../utils/types';
const frScenarioTranslations: TimetableFilterTranslations = readJsonFile<{
  main: TimetableFilterTranslations;
}>('public/locales/fr/operational-studies.json').main;

export const requestedDestination = frScenarioTranslations.requestedDestination;
export const expectedWaypointsPanelDataForUniqueTrain: Record<string, Partial<Waypoint>> = {
  North_East_station: { ch: 'BV', offset: '0.0', checked: true },
  Mid_East_station: { ch: 'BV', offset: '19.55', checked: true },
  [requestedPoint('2')]: { offset: '22.47', checked: true },
  Mid_West_station: { ch: 'BV', offset: '34.0', checked: true },
  North_West_station: { ch: 'BC', offset: '47.55', checked: true },
};

export const expectedWaypointsPanelDataForPacedTrain: Record<string, Partial<Waypoint>> = {
  North_East_station: { ch: 'BV', offset: '0.0', checked: true },
  Mid_East_station: { ch: 'BV', offset: '19.55', checked: true },
  [requestedPoint('1')]: { offset: '22.47', checked: true },
  Mid_West_station: { ch: 'BV', offset: '34.0', checked: true },
  North_West_station: { ch: 'BV', offset: '47.60', checked: true },
  [requestedDestination]: { offset: '47.65', checked: true },
};

export const expectedWaypointsListDataForPacedTrain: Record<string, Partial<Waypoint>> = {
  North_East_station: { ch: 'BV', offset: '0' },
  [requestedPoint('1')]: { offset: '22.5' },
  Mid_West_station: { ch: 'BV', offset: '34' },
  [requestedDestination]: { offset: '47.7' },
};

export const expectedWaypointsListDataForUniqueTrain: Record<string, Partial<Waypoint>> = {
  North_East_station: { ch: 'BV', offset: '0' },
  Mid_East_station: { ch: 'BV', offset: '19.6' },
  Mid_West_station: { ch: 'BV', offset: '34' },
  North_West_station: { ch: 'BC', offset: '47.6' },
};

export const WAYPOINT_CHECKBOX_STATE = { checked: 3, total: 5 };
export const STD_MANCHETTE = {
  occupancyWaypointIndex: 1,
  requestedWaypointIndex: 2,
  normalWaypointIndex: 3,

  initialVisibleWaypoints: 4,
  visibleAfterHidingRequested: 3,

  waypointPanel: {
    expectedChecked: 3,
    expectedTotal: 5,
  },
};
