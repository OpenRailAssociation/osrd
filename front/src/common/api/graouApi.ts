import get from 'axios';

import { TrainScheduleImportConfig } from 'applications/operationalStudies/types';
import { ImportStation } from 'common/StationCard';

export const GRAOU_URL = 'https://graou.info';

export const getGraouTrainSchedules = async (config: TrainScheduleImportConfig) => {
  const params = {
    q: 'trains',
    config,
  };
  try {
    const result = await get(`${GRAOU_URL}/api/trainschedules.php`, { params });
    return result.data;
  } catch (error) {
    console.error(error);
  }
}

/**
 * Search the stations by name or by trigram
 * (trigram if term.length < 3, by name otherwise)
 */
export const searchGraouStations = async (term: string) => {
  const params = {
    q: 'stations',
    term,
  };
  try {
    const result = await get(`${GRAOU_URL}/api/stations.php`, { params });
    return result.data as ImportStation[];
  } catch (error) {
    console.error(error);
    return;
  }
}
