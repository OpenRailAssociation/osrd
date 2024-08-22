import type { TrainScheduleImportConfig } from 'applications/operationalStudies/types';
import type { ImportStation } from 'common/StationCard';

export const GRAOU_URL = 'https://graou.info';

export const getGraouTrainSchedules = async (config: TrainScheduleImportConfig) => {
  const params = new URLSearchParams({
    q: 'trains',
    config: JSON.stringify(config),
  });
  try {
    const res = await fetch(`${GRAOU_URL}/api/trainschedules.php?${params}`);
    return res.json();
  } catch (error) {
    console.error(error);
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
