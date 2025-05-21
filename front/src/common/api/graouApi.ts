import type {
  ImportStation,
  TrainScheduleImportConfig,
} from 'applications/operationalStudies/types';
import { setFailure } from 'reducers/main';
import { castErrorToFailure } from 'utils/error';

const GRAOU_URL = 'https://graou.info';

export const getGraouTrainSchedules = async (config: TrainScheduleImportConfig) => {
  const params = new URLSearchParams({
    q: 'trains',
    config: JSON.stringify(config),
  });
  try {
    const res = await fetch(`${GRAOU_URL}/api/trainschedules.php?${params}`);
    return res.json() as Promise<Record<string, unknown>[]>;
  } catch (error) {
    setFailure(castErrorToFailure(error));
    return null;
  }
};

/**
 * Search the stations by name or by trigram
 * (trigram if term.length < 3, by name otherwise)
 */
export const searchGraouStations = async (term: string) => {
  const params = new URLSearchParams({
    q: 'stations',
    term,
  });
  try {
    const res = await fetch(`${GRAOU_URL}/api/stations.php?${params}`);
    return (await res.json()) as ImportStation[];
  } catch (error) {
    console.error(error);
    return null;
  }
};
