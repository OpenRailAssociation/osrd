import { readJsonFile } from '../../utils/file-utils';
import type { Waypoint } from '../../utils/manchette';
import type { TimetableFilterTranslations } from '../../utils/types';
const frScenarioTranslations: TimetableFilterTranslations = readJsonFile<{
  main: TimetableFilterTranslations;
}>('public/locales/fr/operational-studies.json').main;

export const requestedDestination = frScenarioTranslations.requestedDestination;
export const expectedWaypointsPanelDataForUniqueTrain: Record<string, Partial<Waypoint>> = {
  North_East_station: { secondaryCode: 'BV', offset: '0.0', checked: true },
  Mid_East_station: { secondaryCode: 'BV', offset: '19.55', checked: true },
  Mid_West_station: { secondaryCode: 'BV', offset: '34.0', checked: true },
  North_West_station: { secondaryCode: 'BC', offset: '47.55', checked: true },
};

export const expectedWaypointsPanelDataForPacedTrain: Record<string, Partial<Waypoint>> = {
  North_East_station: { secondaryCode: 'BV', offset: '0.0', checked: true },
  Mid_East_station: { secondaryCode: 'BV', offset: '19.55', checked: true },
  Mid_West_station: { secondaryCode: 'BV', offset: '34.0', checked: true },
  North_West_station: { secondaryCode: 'BV', offset: '47.60', checked: true },
};

export const expectedWaypointsListDataForPacedTrain: Record<string, Partial<Waypoint>> = {
  North_East_station: { secondaryCode: 'BV', offset: '0' },
  Mid_East_station: { secondaryCode: 'BV', offset: '19.6' },
  Mid_West_station: { secondaryCode: 'BV', offset: '34' },
  North_West_station: { secondaryCode: 'BV', offset: '47.6' },
};

export const expectedWaypointsListDataForUniqueTrain: Record<string, Partial<Waypoint>> = {
  North_East_station: { secondaryCode: 'BV', offset: '0' },
  Mid_East_station: { secondaryCode: 'BV', offset: '19.6' },
  Mid_West_station: { secondaryCode: 'BV', offset: '34' },
  North_West_station: { secondaryCode: 'BC', offset: '47.6' },
};

export const WAYPOINT_CHECKBOX_STATE = { checked: 2, total: 4 };
export const STD_MANCHETTE = {
  occupancyWaypointIndex: 1,
  firstHiddenWaypointIndex: 3,
  secondHiddenWaypointIndex: 2,

  initialVisibleWaypoints: 4,
  visibleAfterHidingFirstWaypoint: 3,
  visibleAfterHidingSecondWaypoint: 2,

  waypointPanel: {
    expectedChecked: 2,
    expectedTotal: 4,
  },
};
