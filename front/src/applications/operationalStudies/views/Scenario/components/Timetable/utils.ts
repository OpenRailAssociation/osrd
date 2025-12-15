import dayjs from 'dayjs';
import { omit } from 'lodash';

import type { RoundTripsFromJson } from 'applications/operationalStudies/types';
import type {
  PacedTrain,
  SubCategory,
  TrainMainCategory,
  TrainSchedule,
  RoundTrips,
  TrainScheduleSet,
} from 'common/api/osrdEditoastApi';
import isMainCategory from 'modules/rollingStock/helpers/category';
import type { SimulationSummary, TimetableItemWithDetails } from 'modules/timetableItem/types';
import type { TimetableItem, TimetableItemId } from 'reducers/osrdconf/types';
import type { Duration } from 'utils/duration';
import {
  extractEditoastIdFromPacedTrainId,
  extractEditoastIdFromTrainScheduleId,
  isPacedTrainResponseWithPacedTrainId,
} from 'utils/trainId';

import { specialCodeDictionary, TRAIN_MAIN_CATEGORY_CLASS } from './consts';

/** Filter timetable items by their names and labels */
export const keepItem = (name: string | undefined, labels: string[], searchString: string) => {
  if (!searchString) return true;
  if (!name) return false;
  const isNameFilterInTimetable = name.toLowerCase().includes(searchString.toLowerCase());
  const searchStringInTags = labels.join('').toLowerCase().includes(searchString.toLowerCase());
  return isNameFilterInTimetable || searchStringInTags;
};

export const extractTagCode = (tag?: string | null) => {
  if (!tag) {
    return 'NO CODE';
  }
  if (tag in specialCodeDictionary) {
    return specialCodeDictionary[tag];
  }

  const matches = tag.match(/\w+$/);
  return matches ? matches[0] : tag;
};

export const timetableHasInvalidItem = (timetableItems: TimetableItemWithDetails[]) =>
  timetableItems.some((timetableItem) => timetableItem.summary && !timetableItem.summary.isValid);

export const formatTrainDuration = (duration: Duration) =>
  dayjs.duration(duration.ms).format('HH[h]mm');

export const formatTimetableItems = (
  timetableItems: TimetableItem[],
  selectedTimeTableIdsFromClick: TimetableItemId[]
) => {
  const trainScheduleIndexByEditoastId = new Map<number, number>();
  const pacedTrainIndexByEditoastId = new Map<number, number>();

  const formattedTimetableItems = timetableItems
    .filter(({ id }) => selectedTimeTableIdsFromClick.includes(id))
    .reduce<{
      train_schedules: TrainSchedule[];
      paced_trains: PacedTrain[];
    }>(
      (acc, timetableItem) => {
        if (isPacedTrainResponseWithPacedTrainId(timetableItem)) {
          const pacedTrainEditoastId = extractEditoastIdFromPacedTrainId(timetableItem.id);
          pacedTrainIndexByEditoastId.set(pacedTrainEditoastId, acc.paced_trains.length);
          acc.paced_trains.push(omit(timetableItem, ['id']));
        } else {
          const trainScheduleEditoastId = extractEditoastIdFromTrainScheduleId(timetableItem.id);
          trainScheduleIndexByEditoastId.set(trainScheduleEditoastId, acc.train_schedules.length);
          acc.train_schedules.push(omit(timetableItem, ['id']));
        }
        return acc;
      },
      { train_schedules: [], paced_trains: [] }
    );

  return { formattedTimetableItems, trainScheduleIndexByEditoastId, pacedTrainIndexByEditoastId };
};

export const copyTimetableItemsToClipboard = async (
  selectedTimeTableIdsFromClick: TimetableItemId[],
  timetableItems: TimetableItem[]
) => {
  const { formattedTimetableItems } = formatTimetableItems(
    timetableItems,
    selectedTimeTableIdsFromClick
  );
  const jsonString = JSON.stringify(formattedTimetableItems);
  const blob = new Blob([jsonString], { type: 'text/plain' });
  const clipboardItem = new ClipboardItem({ [blob.type]: blob });
  await navigator.clipboard.write([clipboardItem]);
};

/**
 * turns editoast ids into corresponding indexes in exported arrays
 */
function mapRoundTripsToIndexes(
  roundTrips: RoundTrips | undefined,
  indexByEditoastId: Map<number, number>
) {
  if (!roundTrips) return [];

  const seenIndexes = new Set<number>();
  const roundTripIndexes: ([number, number] | [number, null])[] = [];

  for (const oneWayId of roundTrips.one_ways ?? []) {
    const index = indexByEditoastId.get(oneWayId);
    if (index === undefined || seenIndexes.has(index)) {
      continue;
    }
    seenIndexes.add(index);
    roundTripIndexes.push([index, null]);
  }

  for (const [outboundId, inboundId] of roundTrips.round_trips ?? []) {
    const outboundIndex = indexByEditoastId.get(outboundId);
    const inboundIndex = indexByEditoastId.get(inboundId);

    if (
      outboundIndex === undefined ||
      inboundIndex === undefined ||
      seenIndexes.has(outboundIndex) ||
      seenIndexes.has(inboundIndex)
    ) {
      continue;
    }

    seenIndexes.add(outboundIndex);
    seenIndexes.add(inboundIndex);
    roundTripIndexes.push([outboundIndex, inboundIndex]);
  }

  return roundTripIndexes;
}

type TimetableExportPayload = {
  train_schedules: TrainSchedule[];
  paced_trains: PacedTrain[];
  round_trips?: RoundTripsFromJson;
};

export const buildTimetableExportPayload = (
  timetableItems: TimetableItem[],
  selectedTimeTableIdsFromClick: TimetableItemId[],
  trainScheduleRoundTrips?: RoundTrips,
  pacedTrainRoundTrips?: RoundTrips
): TimetableExportPayload => {
  const { formattedTimetableItems, trainScheduleIndexByEditoastId, pacedTrainIndexByEditoastId } =
    formatTimetableItems(timetableItems, selectedTimeTableIdsFromClick);

  const roundTrips: RoundTripsFromJson = {
    train_schedules: mapRoundTripsToIndexes(
      trainScheduleRoundTrips,
      trainScheduleIndexByEditoastId
    ),
    paced_trains: mapRoundTripsToIndexes(pacedTrainRoundTrips, pacedTrainIndexByEditoastId),
  };

  if (roundTrips.train_schedules.length === 0 && roundTrips.paced_trains.length === 0) {
    return formattedTimetableItems;
  }

  return { ...formattedTimetableItems, round_trips: roundTrips };
};

export const exportTimetableItems = (
  selectedTimeTableIdsFromClick: TimetableItemId[],
  timetableItems: TimetableItem[],
  trainScheduleRoundTrips?: RoundTrips,
  pacedTrainRoundTrips?: RoundTrips
) => {
  if (!timetableItems) return;

  const payload = buildTimetableExportPayload(
    timetableItems,
    selectedTimeTableIdsFromClick,
    trainScheduleRoundTrips,
    pacedTrainRoundTrips
  );

  const jsonString = JSON.stringify(payload);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'timetable.json';
  a.click();
};

export function extractCategoryId(fullId: string): TrainMainCategory[] | SubCategory['code'] {
  const [prefix, code] = fullId.split(':');

  if (prefix === 'main' || prefix === 'sub') {
    return code;
  }

  throw new Error(`Unknown category prefix: ${prefix}`);
}
export const getTrainCategoryClassName = (
  trainCategory: PacedTrain['category'],
  type: 'bg' | 'text'
) => {
  if (!trainCategory) return `train-category-${type}-none`;
  if (isMainCategory(trainCategory)) {
    return `train-category-${type}-${TRAIN_MAIN_CATEGORY_CLASS[trainCategory.main_category]}`;
  }
  return null;
};

// TODO: Reason received when a pathfinding failed. Remove this when issue #12772 is resolved.
export const isValidPathfinding = (summaryTrain: SimulationSummary | undefined) => {
  if (!summaryTrain) return false;
  if ('invalidReason' in summaryTrain) {
    return ![
      'pathfinding_failure',
      'not_found_in_blocks',
      'not_found_in_routes',
      'not_found_in_tracks',
      'incompatible_constraints',
    ].includes(summaryTrain.invalidReason);
  }
  return true;
};

export const isSandbox = (trainScheduleSet: TrainScheduleSet) => !trainScheduleSet.name;

export const computeTimetablePackageName = (
  trainScheduleSetName: string,
  catalogName?: string
): string => (catalogName ? `${catalogName} | ${trainScheduleSetName}` : trainScheduleSetName);

export const sortTrainScheduleSets = (
  set1: TrainScheduleSet,
  set2: TrainScheduleSet,
  catalogEntryNameById: Map<number, string>
): number => {
  const set1CatalogId = set1.catalog_entry_id;
  const set2CatalogId = set2.catalog_entry_id;

  const catalogName1 = set1CatalogId ? (catalogEntryNameById.get(set1CatalogId) ?? null) : null;
  const catalogName2 = set2CatalogId ? (catalogEntryNameById.get(set2CatalogId) ?? null) : null;

  // If no catalog name, put at the end
  if (!catalogName1 && catalogName2) return 1;
  if (catalogName1 && !catalogName2) return -1;

  // If sandbox, put at the very end
  if (isSandbox(set1) && !isSandbox(set2)) return 1;
  if (!isSandbox(set1) && isSandbox(set2)) return -1;

  // If both have catalog names, build full names and compare
  if (catalogName1 && catalogName2) {
    const fullName1 = computeTimetablePackageName(set1.name ?? '', catalogName1);
    const fullName2 = computeTimetablePackageName(set2.name ?? '', catalogName2);
    return fullName1.localeCompare(fullName2);
  }

  // Compare by set name if no catalog entry
  const name1 = set1.name ?? '';
  const name2 = set2.name ?? '';
  if (name1 < name2) return -1;
  if (name1 > name2) return 1;
  return 0;
};
