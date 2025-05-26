import type { CichDictValue, TimetableJsonPayload } from 'applications/operationalStudies/types';
import type { PacedTrain, TrainSchedule } from 'common/api/osrdEditoastApi';
import { Duration } from 'utils/duration';

import { buildSteps, cleanTimeFormat } from './buildStepsFromOcp';
import findMostFrequentScheduleInPacedTrain from './findMostFrequentXmlSchedule';

const extractCiChCode = (code: string) => {
  const [ciCode, chCode] = code.split('/');
  return { ciCode: Number(ciCode), chCode };
};

const mapTrainNames = (trainSchedules: TrainSchedule[], trains: Element[]): TrainSchedule[] => {
  const trainPartToTrainMap: Record<string, string> = {};

  trains.forEach((train) => {
    const trainPartRef = train.getElementsByTagName('trainPartRef')[0]?.getAttribute('ref');
    const trainName = train.getAttribute('name') || '';
    if (trainPartRef) {
      trainPartToTrainMap[trainPartRef] = trainName;
    }
  });

  const updatedTrainSchedules = trainSchedules.map((schedule) => {
    const mappedTrainNumber = trainPartToTrainMap[schedule.train_name] || schedule.train_name;

    return {
      ...schedule,
      train_name: mappedTrainNumber,
    };
  });

  return updatedTrainSchedules;
};

const parseXML = async (xmlDoc: Document): Promise<TimetableJsonPayload> => {
  const trainSchedules: TrainSchedule[] = [];

  // Initialize localCichDict
  const localCichDict: Record<string, CichDictValue> = {};

  const infrastructures = Array.from(xmlDoc.getElementsByTagName('infrastructure'));

  infrastructures.forEach((infrastructure) => {
    const ocps = Array.from(infrastructure.getElementsByTagName('ocp'));

    ocps.forEach((ocp) => {
      const id = ocp.getAttribute('id');
      const code = ocp.getAttribute('code');

      if (id && code) {
        const { ciCode, chCode } = extractCiChCode(code);
        localCichDict[id] = { ciCode, chCode };
      }
    });
  });

  const pacedTrains: Record<string, TrainSchedule[]> = {};
  const trainGroups = Array.from(xmlDoc.getElementsByTagName('trainGroup'));

  const trainSchedulesByTrainPartId: Record<string, TrainSchedule> = {};
  const trainParts = Array.from(xmlDoc.getElementsByTagName('trainPart'));
  const period = xmlDoc.getElementsByTagName('timetablePeriod')[0];
  const startDate = period ? period.getAttribute('startDate') : null;

  if (!startDate) {
    console.error('Start Date not found in the timetablePeriod.');
    return { train_schedules: [], paced_trains: [] };
  }

  trainParts.forEach((train) => {
    const trainNumber = train.getAttribute('id') || '';
    const trainPartId = train.getAttribute('id') || '';
    const ocpSteps = Array.from(train.getElementsByTagName('ocpTT'));
    const formationTT = train.getElementsByTagName('formationTT')[0];
    const rollingStockXml = formationTT?.getAttribute('formationRef');
    const firstOcpTT = ocpSteps[0];
    const firstDepartureTime = firstOcpTT
      .getElementsByTagName('times')[0]
      ?.getAttribute('departure');

    const firstDepartureTimeformatted = firstDepartureTime && cleanTimeFormat(firstDepartureTime);

    // Build steps using the fully populated localCichDict
    const { path, schedule } = buildSteps(ocpSteps, localCichDict, new Date(startDate));

    const trainSchedule: TrainSchedule = {
      train_name: trainNumber,
      rolling_stock_name: rollingStockXml || '', // RollingStocks in xml files rarely have the correct format
      start_time: new Date(`${startDate} ${firstDepartureTimeformatted}`).toISOString(),
      constraint_distribution: 'MARECO',
      path,
      schedule,
    };
    trainSchedulesByTrainPartId[trainPartId] = trainSchedule;
    trainSchedules.push(trainSchedule);
  });

  const trainElementsById: Record<string, Element> = {};
  Array.from(xmlDoc.getElementsByTagName('train')).forEach((train) => {
    const id = train.getAttribute('id');
    if (id) {
      trainElementsById[id] = train;
    }
  });

  trainGroups.forEach((trainGroup) => {
    const pacedTrainId = trainGroup.getAttribute('id')!;

    const trainRefs = Array.from(trainGroup.getElementsByTagName('trainRef'));
    pacedTrains[pacedTrainId] = trainRefs
      .map((trainRef) => {
        const trainId = trainRef.getAttribute('ref');
        const trainElement = trainId ? trainElementsById[trainId] : undefined;

        const trainPartRef = trainElement?.querySelector('trainPartRef')?.getAttribute('ref');

        return trainPartRef ? trainSchedulesByTrainPartId[trainPartRef] : undefined;
      })
      .filter((schedule) => schedule !== undefined);
  });

  const pacedTrainMostFrequentSchedules: Record<
    string,
    { schedule: TrainSchedule | null; count: number }
  > = {};

  Object.entries(pacedTrains).forEach(([pacedTrainId, schedules]) => {
    const { mostFrequent, highestCount } = findMostFrequentScheduleInPacedTrain(schedules);
    pacedTrainMostFrequentSchedules[pacedTrainId] = {
      schedule: mostFrequent,
      count: highestCount,
    };
  });

  const getMostFrequentInterval = (schedules: TrainSchedule[]): Duration => {
    const departureTimes = schedules
      .map((s) => new Date(s.start_time))
      .sort((a, b) => a.getTime() - b.getTime());

    const intervalsCount = new Map<number, number>();

    for (let i = 1; i < departureTimes.length; i += 1) {
      const interval = Duration.subtractDate(departureTimes[i], departureTimes[i - 1]);
      const rawMin = interval.total('minute');

      let roundedMin: number;
      if (rawMin > 5) {
        roundedMin = Math.round(rawMin / 10) * 10;
      } else if (rawMin >= 1) {
        roundedMin = Math.round(rawMin);
      } else {
        roundedMin = 1;
      }

      intervalsCount.set(roundedMin, (intervalsCount.get(roundedMin) || 0) + 1);
    }

    let mostFrequentRoundedMin = 0;
    let maxCount = 0;

    for (const [minutes, count] of intervalsCount.entries()) {
      if (count > maxCount) {
        mostFrequentRoundedMin = minutes;
        maxCount = count;
      } else if (count === maxCount && minutes < mostFrequentRoundedMin) {
        // we take smaller interval in case of tie
        mostFrequentRoundedMin = minutes;
      }
    }

    return new Duration({ minutes: mostFrequentRoundedMin });
  };

  const buildPacedTrain = (
    pacedTrainId: string,
    pacedTrainSchedules: TrainSchedule[]
  ): PacedTrain | null => {
    if (pacedTrainSchedules.length < 2) {
      console.warn('Not enough schedules to build a paced train');
      return null;
    }

    const sortedSchedules = pacedTrainSchedules.sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );

    const departureDates = sortedSchedules.map((s) => new Date(s.start_time));
    const intervalDuration = getMostFrequentInterval(pacedTrainSchedules);

    const totalDuration = Duration.subtractDate(
      departureDates[departureDates.length - 1],
      departureDates[0]
    ).add(intervalDuration);

    return {
      ...sortedSchedules[0],
      train_name: pacedTrainId,
      paced: {
        interval: intervalDuration.toISOString(),
        time_window: totalDuration.toISOString(),
      },
      exceptions: [],
    };
  };

  const importedPacedTrains: PacedTrain[] = Object.entries(pacedTrains)
    .map(([pacedTrainId, pacedTrainSchedules]) =>
      buildPacedTrain(pacedTrainId, pacedTrainSchedules)
    )
    .filter((pacedTrain) => pacedTrain !== null);

  const trainSchedulesInPacedTrain = new Set(
    Object.values(pacedTrains)
      .flat()
      .map((schedule) => schedule.train_name)
  );
  const singleTrainSchedules = trainSchedules.filter(
    (schedule) => !trainSchedulesInPacedTrain.has(schedule.train_name)
  );

  const trains = Array.from(xmlDoc.getElementsByTagName('train'));
  const updatedTrainSchedules = mapTrainNames(singleTrainSchedules, trains);

  return { train_schedules: updatedTrainSchedules, paced_trains: importedPacedTrains };
};

export default parseXML;
