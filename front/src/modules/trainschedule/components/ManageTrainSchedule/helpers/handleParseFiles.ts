import { t } from 'i18next';
import type { Dispatch } from 'redux';

import type { ImportedTrainSchedule } from 'applications/operationalStudies/types';
import { type TrainScheduleBase } from 'common/api/osrdEditoastApi';
import { setFailure } from 'reducers/main';

export const handleFileReadingError = (error: Error) => {
  console.error('File reading error:', error);
};

export const handleJsonParsingError = (error: Error, dispatch: Dispatch) => {
  console.error('Error parsing JSON:', error);
  dispatch(
    setFailure({
      name: t('errorMessages.error'),
      message: t('errorMessages.errorInvalidJSONFormat'),
    })
  );
};

export const handleXmlParsingError = (error: Error, dispatch: Dispatch) => {
  console.error('Error parsing XML/RailML:', error);
  dispatch(
    setFailure({
      name: t('errorMessages.error'),
      message: t('errorMessages.errorInvalidXMLFormat'),
    })
  );
};

export const processJsonFile = (
  fileContent: string,
  setTrainsJsonData: (data: TrainScheduleBase[]) => void,
  dispatch: Dispatch
) => {
  try {
    const importedTrainSchedules: TrainScheduleBase[] = JSON.parse(fileContent);
    if (importedTrainSchedules && importedTrainSchedules.length > 0) {
      setTrainsJsonData(importedTrainSchedules);
    }
  } catch (error) {
    handleJsonParsingError(error as Error, dispatch);
  }
};

export const processXmlFile = async (
  fileContent: string,
  parseRailML: (xmlDoc: Document) => Promise<ImportedTrainSchedule[]>,
  updateTrainSchedules: (schedules: ImportedTrainSchedule[]) => void,
  dispatch: Dispatch
) => {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(fileContent, 'application/xml');
    const parserError = xmlDoc.getElementsByTagName('parsererror');

    if (parserError.length > 0) {
      throw new Error('Invalid XML');
    }

    const importedTrainSchedules = await parseRailML(xmlDoc);
    if (importedTrainSchedules && importedTrainSchedules.length > 0) {
      updateTrainSchedules(importedTrainSchedules);
    }
  } catch (error) {
    handleXmlParsingError(error as Error, dispatch);
  }
};

export const handleUnsupportedFileType = (dispatch: Dispatch) => {
  console.error('Unsupported file type');
  dispatch(
    setFailure({
      name: t('errorMessages.error'),
      message: t('errorMessages.errorUnsupportedFileType'),
    })
  );
};
