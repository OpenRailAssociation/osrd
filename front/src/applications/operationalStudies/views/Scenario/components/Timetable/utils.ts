import dayjs from 'dayjs';
import { omit } from 'lodash';

import type { RoundTripsFromJson } from 'applications/operationalStudies/types';
import type {
  TrainSchedule,
  SubCategory,
  TrainMainCategory,
  RoundTrips,
  TrainScheduleSet,
  CatalogEntry,
} from 'common/api/osrdEditoastApi';
import isMainCategory from 'modules/rollingStock/helpers/category';
import type { SimulationSummary, TrainScheduleWithDetails } from 'modules/timetableItem/types';
import type { TimetableItem } from 'reducers/osrdconf/types';
import type { Duration } from 'utils/duration';

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

export const timetableHasInvalidTrainSchedule = (trainSchedules: TrainScheduleWithDetails[]) =>
  trainSchedules.some((trainSchedule) => trainSchedule.summary && !trainSchedule.summary.isValid);

export const formatTrainDuration = (duration: Duration) =>
  dayjs.duration(duration.ms).format('HH[h]mm');

const formatTimetableItemsForExport = (
  timetableItems: TimetableItem[],
  selectedTimeTableIdsFromClick: number[]
) => {
  const pacedTrainIndexByEditoastId = new Map<number, number>();

  const pacedTrains = timetableItems
    .filter(({ id }) => selectedTimeTableIdsFromClick.includes(id))
    .reduce<TrainSchedule[]>((acc, timetableItem) => {
      pacedTrainIndexByEditoastId.set(timetableItem.id, acc.length);
      acc.push(omit(timetableItem, ['id', 'train_schedule_set_id']));
      return acc;
    }, []);

  return {
    formattedTimetableItems: pacedTrains,
    pacedTrainIndexByEditoastId,
  };
};

export const copyTimetableItemsToClipboard = async (
  selectedTimeTableIdsFromClick: number[],
  timetableItems: TimetableItem[]
) => {
  const { formattedTimetableItems } = formatTimetableItemsForExport(
    timetableItems,
    selectedTimeTableIdsFromClick
  );
  const jsonString = JSON.stringify({ paced_trains: formattedTimetableItems });
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
  paced_trains: TrainSchedule[];
  round_trips?: RoundTripsFromJson;
};

export const buildTimetableExportPayload = (
  timetableItems: TimetableItem[],
  selectedTimeTableIdsFromClick: number[],
  roundTrips?: RoundTrips
): TimetableExportPayload => {
  const { formattedTimetableItems, pacedTrainIndexByEditoastId } = formatTimetableItemsForExport(
    timetableItems,
    selectedTimeTableIdsFromClick
  );

  const mappedRoundTrips: RoundTripsFromJson = mapRoundTripsToIndexes(
    roundTrips,
    pacedTrainIndexByEditoastId
  );

  return {
    paced_trains: formattedTimetableItems,
    round_trips: (mappedRoundTrips?.length ?? 0) > 0 ? mappedRoundTrips : undefined,
  };
};

export const exportTimetableItems = (
  selectedTimeTableIdsFromClick: number[],
  timetableItems: TimetableItem[],
  roundTrips?: RoundTrips
) => {
  if (!timetableItems) return;

  const payload = buildTimetableExportPayload(
    timetableItems,
    selectedTimeTableIdsFromClick,
    roundTrips
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
  trainCategory: TrainSchedule['category'],
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

export const computeTrainScheduleSetName = (
  trainScheduleSetName: string,
  catalogName?: string | null
): string => (catalogName ? `${catalogName} | ${trainScheduleSetName}` : trainScheduleSetName);

export const sortTrainScheduleSets = (
  set1: TrainScheduleSet,
  set2: TrainScheduleSet,
  catalogEntryNameById: Map<number, CatalogEntry>
): number => {
  const set1CatalogId = set1.catalog_entry_id;
  const set2CatalogId = set2.catalog_entry_id;

  const catalog1 = set1CatalogId ? (catalogEntryNameById.get(set1CatalogId) ?? null) : null;
  const catalog2 = set2CatalogId ? (catalogEntryNameById.get(set2CatalogId) ?? null) : null;

  // If no catalog name, put at the end
  if (!catalog1 && catalog2) return 1;
  if (catalog1 && !catalog2) return -1;

  // If sandbox, put at the very end
  if (isSandbox(set1) && !isSandbox(set2)) return 1;
  if (!isSandbox(set1) && isSandbox(set2)) return -1;

  // If both have catalog names, build full names and compare
  if (catalog1 && catalog2) {
    const fullName1 = computeTrainScheduleSetName(set1.name ?? '', catalog1.name);
    const fullName2 = computeTrainScheduleSetName(set2.name ?? '', catalog2.name);
    return fullName1.localeCompare(fullName2);
  }

  // Compare by set name if no catalog entry
  const name1 = set1.name ?? '';
  const name2 = set2.name ?? '';
  if (name1 < name2) return -1;
  if (name1 > name2) return 1;
  return 0;
};
