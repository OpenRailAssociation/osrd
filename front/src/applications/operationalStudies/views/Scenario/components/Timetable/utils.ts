import dayjs from 'dayjs';
import { omit } from 'lodash';

import { generateBareOccurrences } from 'applications/operationalStudies/helpers/generateBareOccurrences';
import type { RoundTripsFromJson } from 'applications/operationalStudies/types';
import type {
  TrainSchedule,
  SubCategory,
  TrainMainCategory,
  RoundTrips,
  TrainScheduleSet,
  CatalogEntry,
  TrainScheduleResponse,
} from 'common/api/osrdEditoastApi';
import isMainCategory from 'modules/rollingStock/helpers/category';
import type { SimulationSummary, TrainScheduleWithDetails } from 'modules/trainSchedule/types';
import { Duration } from 'utils/duration';

import { specialCodeDictionary, TRAIN_MAIN_CATEGORY_CLASS } from './consts';

/** Filter train  schedules by their names and labels */
export const keepTrain = (name: string | undefined, labels: string[], searchString: string) => {
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

const formatTrainSchedulesForExport = (
  trainSchedules: TrainScheduleResponse[],
  selectedTimeTableIdsFromClick: number[]
) => {
  const trainScheduleIndexByEditoastId = new Map<number, number>();

  const formattedTrainSchedules = trainSchedules
    .filter(({ id }) => selectedTimeTableIdsFromClick.includes(id))
    .reduce<TrainSchedule[]>((acc, trainSchedule) => {
      trainScheduleIndexByEditoastId.set(trainSchedule.id, acc.length);
      acc.push(omit(trainSchedule, ['id', 'train_schedule_set_id']));
      return acc;
    }, []);

  return {
    formattedTrainSchedules,
    trainScheduleIndexByEditoastId,
  };
};

export const copyTrainSchedulesToClipboard = async (
  selectedTimeTableIdsFromClick: number[],
  trainSchedules: TrainScheduleResponse[]
) => {
  const { formattedTrainSchedules } = formatTrainSchedulesForExport(
    trainSchedules,
    selectedTimeTableIdsFromClick
  );
  const jsonString = JSON.stringify({ train_schedules: formattedTrainSchedules });
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
  round_trips?: RoundTripsFromJson;
};

export const buildTimetableExportPayload = (
  trainSchedules: TrainScheduleResponse[],
  selectedTimeTableIdsFromClick: number[],
  roundTrips?: RoundTrips
): TimetableExportPayload => {
  const { formattedTrainSchedules, trainScheduleIndexByEditoastId } = formatTrainSchedulesForExport(
    trainSchedules,
    selectedTimeTableIdsFromClick
  );

  const mappedRoundTrips: RoundTripsFromJson = mapRoundTripsToIndexes(
    roundTrips,
    trainScheduleIndexByEditoastId
  );

  return {
    train_schedules: formattedTrainSchedules,
    round_trips: (mappedRoundTrips?.length ?? 0) > 0 ? mappedRoundTrips : undefined,
  };
};

export const exportTrainSchedules = (
  selectedTimeTableIdsFromClick: number[],
  trainSchedules: TrainScheduleResponse[],
  roundTrips?: RoundTrips
) => {
  if (!trainSchedules) return;

  const payload = buildTimetableExportPayload(
    trainSchedules,
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

/**
 * Compute the latest midnight that happen before the last start time of a set of train schedules,
 * including their occurrences and exceptions.
 */
export function computeLatestMidnight(trainSchedules: TrainScheduleResponse[], now: Date): Date {
  if (trainSchedules.length === 0) {
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    return midnight;
  }

  const latestStartTime = trainSchedules.map(
    (trainSchedule: TrainScheduleResponse): Date | undefined => {
      if (!trainSchedule.paced) return new Date(trainSchedule.start_time);

      const occurrences = generateBareOccurrences({
        id: trainSchedule.id,
        startTime: new Date(trainSchedule.start_time),
        paced: {
          timeWindow: Duration.parse(trainSchedule.paced.time_window),
          interval: Duration.parse(trainSchedule.paced.interval),
          exceptions: trainSchedule.paced.exceptions,
        },
      });

      return occurrences
        .map(({ startTime }) => startTime)
        .toSorted((a, b) => +b - +a)
        .at(0);
    }
  );

  const midnight = new Date(
    latestStartTime.toSorted((a, b) => (a && b ? +b - +a : 0)).at(0) ?? now
  );
  midnight.setHours(0, 0, 0, 0);

  return midnight;
}
