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

/**
 * Requests from graou open data all train schedules with sets departure and arrival stations and in a given time window at a given date.
 *
 * - Throws if the payload is not a list of objects.
 * - Rejects any train schedule lacking required fields.
 * - Filters out any step lacking required fields, using a non-numeric uic, or having an arrival time set before the previous step departure time.
 *
 * Returns the filtered list of train schedules, the count of rejected trains, and the list of names of trains with filtered out steps.
 */
export const getGraouTrainSchedules = async (config: GraouTrainScheduleConfig) => {
  const params = new URLSearchParams({
    q: 'trains',
    config: JSON.stringify(config),
  });
  const res = await fetch(`${GRAOU_URL}/api/trainschedules.php?${params}`);
  const rawTrainSchedules = (await res.json()) as Record<string, unknown>[];

  const filteredTrains: GraouTrainSchedule[] = [];
  const modifiedTrainsNames: string[] = [];
  let rejectedTrainsCount = 0;

  for (const trainSchedule of rawTrainSchedules) {
    if (
      ['trainNumber', 'rollingStock', 'departureTime', 'arrivalTime', 'departure', 'steps'].some(
        (key) => !(key in trainSchedule)
      ) ||
      !Array.isArray(trainSchedule.steps)
    ) {
      rejectedTrainsCount++;
      continue;
    }

    const steps = trainSchedule.steps;
    const filteredSteps = steps.filter(
      (step, i) =>
        !(
          ['arrivalTime', 'departureTime', 'uic', 'name', 'trigram', 'latitude', 'longitude'].some(
            (key) => !(key in step)
          ) || !/^\d+$/.test(step.uic)
        ) &&
        (i === 0 ||
          new Date(step.arrivalTime).getTime() >= new Date(steps[i - 1].departureTime).getTime())
    );

    if (filteredSteps.length < steps.length) {
      modifiedTrainsNames.push(String(trainSchedule.trainNumber));
    }

    filteredTrains.push({
      ...trainSchedule,
      steps: filteredSteps,
    } as GraouTrainSchedule);
  }

  return {
    trainSchedules: filteredTrains,
    rejectedTrainsCount,
    modifiedTrainsNames,
  };
};

/**
 * Search graou open data for stations by name or by trigram
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
