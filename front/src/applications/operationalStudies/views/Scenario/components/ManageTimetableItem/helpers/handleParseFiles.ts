import type { TFunction } from 'i18next';
import type { Dispatch } from 'redux';

import type { TimetableJsonPayload } from 'applications/operationalStudies/types';
import { convertNgeDtoToOsrd } from 'applications/operationalStudies/views/Scenario/components/MacroEditor/ngeToOsrd';
import type { NetzgrafikDto } from 'applications/operationalStudies/views/Scenario/components/NGE/types';
import { type TrainSchedule } from 'common/api/osrdEditoastApi';
import { setFailure } from 'reducers/main';
import { castErrorToFailure } from 'utils/error';

export const handleFileReadingError = (error: Error) => {
  console.error('File reading error:', error);
};

const TRAIN_SCHEDULE_COMPULSORY_KEYS: (keyof TrainSchedule)[] = [
  'constraint_distribution',
  'path',
  'rolling_stock_name',
  'start_time',
  'train_name',
];

const validateTrainSchedules = (importedItems: unknown): TimetableJsonPayload => {
  const { train_schedules: importedTrainSchedules, paced_trains: importedPacedTrains } =
    importedItems as TimetableJsonPayload;

  const isInvalidTrainSchedules = importedTrainSchedules.some((trainSchedule) => {
    if (
      TRAIN_SCHEDULE_COMPULSORY_KEYS.some((key) => !(key in trainSchedule)) ||
      !Array.isArray(trainSchedule.path)
    ) {
      return true;
    }
    const hasInvalidSteps = trainSchedule.path.some((step) => !('id' in step));
    return hasInvalidSteps;
  });

  const isInvalidPacedTrains = importedPacedTrains.some((pacedTrain) => {
    if (
      [...TRAIN_SCHEDULE_COMPULSORY_KEYS, 'paced'].some((key) => !(key in pacedTrain)) ||
      !Array.isArray(pacedTrain.path)
    ) {
      return true;
    }
    const hasInvalidSteps = pacedTrain.path.some((step) => !('id' in step));
    return hasInvalidSteps;
  });

  if (isInvalidTrainSchedules) {
    throw new Error('Invalid train schedules: some compulsory keys are missing');
  }

  if (isInvalidPacedTrains) {
    throw new Error('Invalid paced trains: some compulsory keys are missing');
  }
  return { train_schedules: importedTrainSchedules, paced_trains: importedPacedTrains };
};

const validateNgeDto = (payload: unknown): payload is NetzgrafikDto =>
  Boolean(
    payload &&
      typeof payload === 'object' &&
      'nodes' in payload &&
      'trainruns' in payload &&
      'trainrunSections' in payload
  );

export const processJsonFile = (
  fileContent: string,
  fileExtension: string,
  setTrainsJsonData: (data: TimetableJsonPayload) => void,
  dispatch: Dispatch,
  t: TFunction<'operational-studies', 'importTrains'>
) => {
  const isJsonFile = fileExtension === 'application/json';

  // try to parse the file content
  let rawContent: unknown;
  try {
    rawContent = JSON.parse(fileContent);
  } catch {
    if (isJsonFile) {
      dispatch(
        setFailure({
          name: t('errorMessages.error'),
          message: t('errorMessages.errorInvalidFile'),
        })
      );
    }
    return isJsonFile;
  }

  if (validateNgeDto(rawContent)) {
    let importedData;
    try {
      importedData = convertNgeDtoToOsrd(rawContent);
    } catch (err) {
      dispatch(setFailure(castErrorToFailure(err)));
      return true;
    }
    setTrainsJsonData(importedData);
    return true;
  }

  // validate the trainSchedules
  try {
    const importedTrainSchedules = validateTrainSchedules(rawContent);
    if (
      importedTrainSchedules.train_schedules.length > 0 ||
      importedTrainSchedules.paced_trains.length > 0
    ) {
      setTrainsJsonData(importedTrainSchedules);
    } else {
      dispatch(
        setFailure({
          name: t('errorMessages.error'),
          message: t('errorMessages.errorEmptyFile'),
        })
      );
    }
  } catch {
    dispatch(
      setFailure({
        name: t('errorMessages.error'),
        message: t('errorMessages.errorInvalidFile'),
      })
    );
  }

  // file has been parsed successfully
  return true;
};
