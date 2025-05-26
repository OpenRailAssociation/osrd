import { setFailure } from 'reducers/main';
import { castErrorToFailure } from 'utils/error';

export type GraouStep = {
  uic: number;
  chCode?: string;
  yard?: string;
  name: string;
  trigram?: string;
  latitude?: number;
  longitude?: number;
  arrivalTime: string;
  departureTime: string;
  duration?: number;
};

export type GraouTrainSchedule = {
  trainNumber: string;
  rollingStock: string | null;
  departureTime: string;
  arrivalTime: string;
  departure: string;
  steps: GraouStep[];
  transilienName?: string;
};

export type GraouStation = {
  trigram?: string;
  name?: string;
  yardname?: string;
  town?: string;
  department?: string;
  region?: string;
  uic?: number;
  linename?: string;
  pk?: string;
  linecode?: string;
};

export type GraouTrainScheduleConfig = {
  from: GraouStation;
  to: GraouStation;
  date: string;
  startTime: string;
  endTime: string;
};

const GRAOU_URL = 'https://graou.info';

export const getGraouTrainSchedules = async (config: GraouTrainScheduleConfig) => {
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
    return (await res.json()) as GraouStation[];
  } catch (error) {
    console.error(error);
    return null;
  }
};
