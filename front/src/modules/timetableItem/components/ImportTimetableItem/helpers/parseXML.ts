import { omit } from 'lodash';
import { v4 as uuidV4 } from 'uuid';

import type { CichDictValue, TimetableJsonPayload } from 'applications/operationalStudies/types';
import type { PacedTrain, TrainSchedule, PacedTrainException } from 'common/api/osrdEditoastApi';
import { addDurationToDate, Duration } from 'utils/duration';

import { buildSteps, cleanTimeFormat } from './buildStepsFromOcp';
import findMostFrequentScheduleInPacedTrain from './findMostFrequentXmlSchedule';
import { generatePacedTrainException } from '../../ManageTimetableItem/helpers/buildPacedTrainException';

const extractCiChCode = (code: string) => {
  const [ciCode, chCode] = code.split('/');
  return { ciCode: Number(ciCode), chCode };
};

const trainScheduleToPacedTrain = (
  trainSchedule: TrainSchedule,
  pacedTrainId: string,
  intervalDuration: Duration,
  timeWindowDuration: Duration
): Omit<PacedTrain, 'exceptions'> => ({
  ...trainSchedule,
  train_name: pacedTrainId,
  paced: {
    interval: intervalDuration.toISOString(),
    time_window: timeWindowDuration.toISOString(),
  },
});

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

export const getMostFrequentInterval = (schedules: TrainSchedule[]): Duration => {
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

const reconcilePacedTrainOccurrences = (
  pacedTrainId: string,
  importedTrainSchedules: TrainSchedule[],
  modelTrainSchedule: TrainSchedule,
  intervalDuration: Duration
): PacedTrain | null => {
  if (importedTrainSchedules.length < 2) {
    console.warn(`Not enough schedules to build a paced train for ${pacedTrainId}.`);
    return null;
  }

  const sortedImportedSchedules = [...importedTrainSchedules].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  const firstImportedDepartureTime = new Date(sortedImportedSchedules[0].start_time);
  const lastImportedDepartureTime = new Date(
    sortedImportedSchedules[sortedImportedSchedules.length - 1].start_time
  );

  const totalTimeWindow = Duration.subtractDate(
    lastImportedDepartureTime,
    firstImportedDepartureTime
  ).add(intervalDuration);
  const intervalMinutes = intervalDuration.total('minute');

  const durationBetweenFirstAndLast = Duration.subtractDate(
    lastImportedDepartureTime,
    firstImportedDepartureTime
  );

  const numberOfIntervals = Math.round(
    durationBetweenFirstAndLast.total('minute') / intervalMinutes
  );

  const numberOfExpectedOccurrences = numberOfIntervals + 1;

  const originalPacedTrain: PacedTrain = {
    ...trainScheduleToPacedTrain(
      modelTrainSchedule,
      pacedTrainId,
      intervalDuration,
      totalTimeWindow
    ),
    exceptions: [],
  };

  const osrdDefaultOccurrences: {
    startTime: Date;
    matchedImportedSchedule: TrainSchedule | null;
  }[] = [];
  for (let i = 0; i < numberOfExpectedOccurrences; i += 1) {
    const expectedDepartureTime = addDurationToDate(
      firstImportedDepartureTime,
      new Duration({ minutes: i * intervalMinutes })
    );
    osrdDefaultOccurrences.push({
      startTime: expectedDepartureTime,
      matchedImportedSchedule: null,
    });
  }

  const matchedImportedScheduleKeys = new Set<string>();
  const getScheduleKey = (s: TrainSchedule) => `${s.start_time}`;
  const exceptions: PacedTrainException[] = [];

  // Match OSRD Default Occurrences to imported Trains
  osrdDefaultOccurrences.forEach((osrdOccurrence, index) => {
    let bestCandidate: TrainSchedule | null = null;
    let minTimeDifference = Infinity;

    const availableImportedSchedules = sortedImportedSchedules.filter(
      (schedule) => !matchedImportedScheduleKeys.has(getScheduleKey(schedule))
    );

    availableImportedSchedules.forEach((importedSchedule) => {
      const importedDepartureTime = new Date(importedSchedule.start_time);
      const timeDifferenceMinutes = Math.abs(
        Duration.subtractDate(osrdOccurrence.startTime, importedDepartureTime).total('minute')
      );

      if (
        timeDifferenceMinutes <= intervalMinutes / 4 &&
        timeDifferenceMinutes < minTimeDifference
      ) {
        bestCandidate = importedSchedule;
        minTimeDifference = timeDifferenceMinutes;
      }
    });

    if (bestCandidate) {
      matchedImportedScheduleKeys.add(getScheduleKey(bestCandidate));

      const baseException = generatePacedTrainException(bestCandidate, originalPacedTrain, index);
      const cleanException = omit(baseException, 'train_name');
      // Case 1: OSRD default occurrence has a match in the imported file
      if (Object.keys(cleanException).length > 0) {
        exceptions.push({
          ...cleanException,
          key: uuidV4(),
          occurrence_index: index,
        });
      }
    } else {
      // Case 2: OSRD default occurrence has no match in the imported file
      // Create a disabled exception
      exceptions.push({
        key: uuidV4(),
        occurrence_index: index,
        disabled: true,
      });
    }
  });

  // Processing Unattributed Trains as added exceptions
  sortedImportedSchedules.forEach((importedSchedule) => {
    if (matchedImportedScheduleKeys.has(getScheduleKey(importedSchedule))) {
      return;
    }

    const baseException = generatePacedTrainException(importedSchedule, originalPacedTrain, null);

    const exception: PacedTrainException = {
      ...baseException,
      key: uuidV4(),
    };

    const cleanException = omit(exception, 'train_name');
    exceptions.push(cleanException);
  });

  const pacedTrainBase: PacedTrain = {
    ...originalPacedTrain,
    exceptions,
  };

  return pacedTrainBase;
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
      const code = ocp.getAttribute('code') || ocp.getAttribute('abbrevation');

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
    const trainNumber = train.getAttribute('trainNumber') || train.getAttribute('id') || '';
    const trainPartId = train.getAttribute('id') || '';
    const ocpSteps = Array.from(train.getElementsByTagName('ocpTT'));
    const formationTT = train.getElementsByTagName('formationTT')[0];
    const formationRef = formationTT?.getAttribute('formationRef');

    let rollingStockName = null;
    if (formationRef !== null) {
      const formation = xmlDoc.getElementById(formationRef);
      const vehicleRef = formation?.querySelector('trainOrder vehicleRef');
      const vehicleRefAttribute = vehicleRef?.getAttribute('vehicleRef');
      const vehicle = vehicleRefAttribute ? xmlDoc.getElementById(vehicleRefAttribute) : null;

      rollingStockName = vehicle?.getAttribute('name') || null;
    }

    const firstOcpTT = ocpSteps[0];
    const firstDepartureTime = firstOcpTT
      .getElementsByTagName('times')[0]
      ?.getAttribute('departure');

    const firstDepartureTimeformatted = firstDepartureTime && cleanTimeFormat(firstDepartureTime);

    // Build steps using the fully populated localCichDict
    const { path, schedule } = buildSteps(ocpSteps, localCichDict, new Date(startDate));

    const trainSchedule: TrainSchedule = {
      train_name: trainNumber,
      rolling_stock_name: rollingStockName || formationRef || '', // RollingStocks in xml files rarely have the correct format
      start_time: new Date(`${startDate} ${firstDepartureTimeformatted}`).toISOString(),
      constraint_distribution: 'STANDARD',
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

  const importedPacedTrains: PacedTrain[] = [];
  Object.entries(pacedTrains).forEach(([pacedTrainId, pacedTrainSchedules]) => {
    const modelTrainSchedule = pacedTrainMostFrequentSchedules[pacedTrainId].schedule;

    if (modelTrainSchedule && pacedTrainSchedules.length > 0) {
      const intervalDuration = getMostFrequentInterval(pacedTrainSchedules);

      const pacedTrainWithExceptions = reconcilePacedTrainOccurrences(
        pacedTrainId,
        pacedTrainSchedules,
        modelTrainSchedule,
        intervalDuration
      );

      if (pacedTrainWithExceptions) {
        importedPacedTrains.push(pacedTrainWithExceptions);
      }
    } else {
      console.warn(
        `Could not determine model train or no schedules for pacedTrainId: ${pacedTrainId}.`
      );
    }
  });

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
