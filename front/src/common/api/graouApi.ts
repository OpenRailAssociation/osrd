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
  const res = await fetch(`${GRAOU_URL}/api/trainschedules.php?${params}`);
  const trainSchedules = (await res.json()) as Record<string, unknown>[];

  const isInvalidTrainSchedules = trainSchedules.some((trainSchedule) => {
    if (
      ['trainNumber', 'rollingStock', 'departureTime', 'arrivalTime', 'departure', 'steps'].some(
        (key) => !(key in trainSchedule)
      ) ||
      !Array.isArray(trainSchedule.steps)
    ) {
      return true;
    }
    const hasInvalidSteps = trainSchedule.steps.some((step) =>
      ['arrivalTime', 'departureTime', 'uic', 'name', 'trigram', 'latitude', 'longitude'].some(
        (key) => !(key in step)
      )
    );
    return hasInvalidSteps;
  });
  if (isInvalidTrainSchedules) {
    throw new Error('Invalid train schedules returned by Graou API');
  }

  return trainSchedules as GraouTrainSchedule[];
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
