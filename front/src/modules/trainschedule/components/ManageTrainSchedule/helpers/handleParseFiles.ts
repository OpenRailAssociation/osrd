import type { TFunction } from 'i18next';
import type { Dispatch } from 'redux';

import { convertNgeDtoToOsrd } from 'applications/operationalStudies/components/MacroEditor/ngeToOsrd';
import type {
  NetzgrafikDto,
  TrainrunDto,
} from 'applications/operationalStudies/components/NGE/types';
import type {
  ImportedTrainSchedule,
  TimetableJsonPayload,
} from 'applications/operationalStudies/types';
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

const validateTimetableItems = (importedItems: unknown): TimetableJsonPayload => {
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
  t: TFunction<'operational-studies', 'importTrains'>,
  setFailedTrainruns?: (failed: { trainrun: TrainrunDto; error: unknown }[]) => void
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
    if (
      setFailedTrainruns &&
      importedData.failed_trainruns &&
      importedData.failed_trainruns.length > 0
    ) {
      setFailedTrainruns(importedData.failed_trainruns);
    }
    return true;
  }

  // validate the timetableItems
  try {
    const importedTimetableItems = validateTimetableItems(rawContent);
    if (
      importedTimetableItems.train_schedules.length > 0 ||
      importedTimetableItems.paced_trains.length > 0
    ) {
      setTrainsJsonData(importedTimetableItems);
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

export const processXmlFile = async (
  fileContent: string,
  parseXML: (xmlDoc: Document) => Promise<ImportedTrainSchedule[]>,
  updateTrainSchedules: (schedules: ImportedTrainSchedule[]) => void
) => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(fileContent, 'application/xml');
  const parserError = xmlDoc.getElementsByTagName('parsererror');

  if (parserError.length > 0) {
    throw new Error('Invalid XML');
  }

  const importedTrainSchedules = await parseXML(xmlDoc);
  if (importedTrainSchedules && importedTrainSchedules.length > 0) {
    updateTrainSchedules(importedTrainSchedules);
  }
};
