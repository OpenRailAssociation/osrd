export type GraouStep = {
  uic: string;
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

// The Graou API returns only part of the UIC for French stations: the last
// digit is missing. It's a checksum which uses the Luhn algorithm.
export const populateUicChecksum = (uic: string): string => {
  if (!uic.startsWith('87') || uic.length >= 8) {
    return uic;
  }

  const rawCi = uic.substring(2);
  let checksum = 0;
  for (let i = 0; i < rawCi.length; i++) {
    const digit = Number(rawCi[i]);
    if ((i + 1) % 2 === (rawCi.length + 1) % 2) {
      checksum += digit;
    } else if (digit > 4) {
      checksum += 2 * digit - 9;
    } else {
      checksum += 2 * digit;
    }
  }
  checksum = (10 - (checksum % 10)) % 10;

  return uic + String(checksum);
};

export const getGraouTrainSchedules = async (config: GraouTrainScheduleConfig) => {
  const params = new URLSearchParams({
    q: 'trains',
    config: JSON.stringify(config),
  });
  const res = await fetch(`${GRAOU_URL}/api/trainschedules.php?${params}`);
  const rawTrainSchedules = (await res.json()) as Record<string, unknown>[];

  const isInvalidTrainSchedules = rawTrainSchedules.some((trainSchedule) => {
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

  const trainSchedules = rawTrainSchedules as GraouTrainSchedule[];
  for (const trainSchedule of trainSchedules) {
    for (const step of trainSchedule.steps) {
      step.uic = populateUicChecksum(step.uic);
    }
  }

  return trainSchedules;
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
