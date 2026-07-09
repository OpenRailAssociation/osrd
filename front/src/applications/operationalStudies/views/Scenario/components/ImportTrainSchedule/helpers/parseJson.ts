import type { TFunction } from 'i18next';
import { isObject } from 'lodash';

import type {
  TrainScheduleFromJson,
  RoundTripsFromJson,
  TimetableJsonPayload,
} from 'applications/operationalStudies/types';
import { convertNgeDtoToOsrd } from 'applications/operationalStudies/views/Scenario/components/MacroEditor/ngeToOsrd';
import type { NetzgrafikDto } from 'applications/operationalStudies/views/Scenario/components/NGE/types';
import { type TrainSchedule } from 'common/api/osrdEditoastApi';

const TRAIN_SCHEDULE_COMPULSORY_KEYS: (keyof TrainSchedule)[] = [
  'constraint_distribution',
  'path',
  'rolling_stock_name',
  'start_time',
  'train_name',
];

export type RoundTripsFromJsonCompat = RoundTripsFromJson & {
  train_schedules?: ([number, number] | [number, null])[];
  paced_trains?: ([number, number] | [number, null])[];
};

/**
 * For backward compatibility
 */
export type TimetableJsonPayloadCompat = TimetableJsonPayload & {
  paced_trains?: TrainScheduleFromJson[];
  trains?: TrainScheduleFromJson[];
  round_trips?: RoundTripsFromJsonCompat;
};

const validateRoundTrips = (roundTrips: unknown): RoundTripsFromJson | undefined => {
  if (roundTrips === undefined || roundTrips === null) {
    return;
  }

  if (Array.isArray(roundTrips)) {
    return roundTrips as RoundTripsFromJson;
  }

  // Backward compatibility mode
  if (typeof roundTrips === 'object') {
    const { paced_trains, train_schedules } = roundTrips as Partial<RoundTripsFromJsonCompat>;

    const combinedRoundTrips: RoundTripsFromJson = [
      ...(Array.isArray(paced_trains) ? paced_trains : []),
      ...(Array.isArray(train_schedules) ? train_schedules : []),
    ];

    return combinedRoundTrips.length > 0 ? combinedRoundTrips : undefined;
  }

  throw new Error('Invalid round trips configuration');
};

export const validateTimetableJsonPayload = (importedItems: unknown): TimetableJsonPayload => {
  if (!isObject(importedItems)) {
    throw new Error('Invalid timetable payload');
  }

  const {
    train_schedules: importedTrainSchedules,
    paced_trains: importedPacedTrains,
    round_trips: importedRoundTrips,
    trains: importedTrains,
  } = importedItems as Partial<TimetableJsonPayloadCompat>;

  // TODO : For backward compatibility, paced_trains and trains can be removed in the future
  const allTrains = [
    ...(Array.isArray(importedTrains) ? importedTrains : []),
    ...(Array.isArray(importedPacedTrains) ? importedPacedTrains : []),
    ...(Array.isArray(importedTrainSchedules) ? importedTrainSchedules : []),
  ];

  if (allTrains.length === 0) {
    throw new Error('Invalid timetable payload');
  }

  if (
    (importedRoundTrips?.train_schedules || importedRoundTrips?.paced_trains) &&
    allTrains.length === 0
  ) {
    throw new Error('Invalid round trips configuration');
  }

  const isInvalidPacedTrains = allTrains.some((pacedTrain) => {
    if (
      TRAIN_SCHEDULE_COMPULSORY_KEYS.some((key) => !(key in pacedTrain)) ||
      !Array.isArray(pacedTrain.path)
    ) {
      return true;
    }
    const hasInvalidSteps = pacedTrain.path.some((step) => !('id' in step));
    return hasInvalidSteps;
  });

  if (isInvalidPacedTrains) {
    throw new Error('Invalid paced trains: some compulsory keys are missing');
  }

  const roundTrips = validateRoundTrips(importedRoundTrips);

  return {
    train_schedules: allTrains,
    ...(roundTrips ? { round_trips: roundTrips } : {}),
  };
};

const validateNgeDto = (payload: unknown): payload is NetzgrafikDto =>
  Boolean(
    payload &&
    typeof payload === 'object' &&
    'nodes' in payload &&
    'trainruns' in payload &&
    'trainrunSections' in payload
  );

/**
 * Parse a file as json to a TimetableJsonPayload, assuming either an NGE dto format or directly a TimetableJsonPayload format
 *
 * If the file can not be parsed as json:
 *   - If it has a json extension, throw (bad json)
 *   - Otherwise return null (not a json file, needs to be parsed as something else)
 *
 * If the file can be parsed as json:
 *   - If the content can be parsed to a TimetableJsonPayload containing trains, return the parsed payload!
 *   - Otherwise throw
 */
export const processJsonFile = (
  fileContent: string,
  fileExtension: string,
  t: TFunction<'operational-studies', 'importTrains'>
): TimetableJsonPayload | null => {
  const isJsonFile = fileExtension === 'application/json';

  // try to parse the file content
  let rawContent: unknown;
  try {
    rawContent = JSON.parse(fileContent);
  } catch {
    if (!isJsonFile) return null;
    throw {
      name: t('errorMessages.error'),
      message: t('errorMessages.errorInvalidFile'),
    };
  }

  // try to parse the content as nge
  if (validateNgeDto(rawContent)) {
    return convertNgeDtoToOsrd(rawContent);
  }

  // try to parse the content directly as a TimetableJsonPayload
  try {
    const importedPayload = validateTimetableJsonPayload(rawContent);
    return importedPayload;
  } catch {
    throw {
      name: t('errorMessages.error'),
      message: t('errorMessages.errorInvalidFile'),
    };
  }
};
