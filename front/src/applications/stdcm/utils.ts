import { extractTime } from 'utils/date';

import type { SimulationReportSheetProps } from './types';

function generateRandomString(length: number): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
}

// TODO: The number must be calculated from a hash of stdcm inputs (to have a stable number). It is currently generated randomly, so there could be duplicates.
export function generateCodeNumber(): string {
  const currentDate = new Date();
  const year = currentDate.getFullYear().toString().substr(-2);
  const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
  const randomPart1 = generateRandomString(3);
  const randomPart2 = generateRandomString(3);
  return `${month}${year}-${randomPart1}-${randomPart2}`;
}

// TODO: This function is only used for V1, so it must be deleted when V1 is abandoned.
export function formatCreationDate(date: string) {
  const creationDate = new Date(date);
  const day = creationDate.getDate();
  const month = creationDate.getMonth() + 1;
  const year = creationDate.getFullYear();
  const hours = creationDate.getHours();
  const minutes = creationDate.getMinutes();

  const formattedDay = day < 10 ? `0${day}` : day;
  const formattedMonth = month < 10 ? `0${month}` : month;
  const formattedHours = hours < 10 ? `0${hours}` : hours;
  const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;

  return {
    day: formattedDay,
    month: formattedMonth,
    year,
    hours: formattedHours,
    minutes: formattedMinutes,
  };
}

export function extractSpeedLimit(speedLimitByTag: string): string {
  const parts = speedLimitByTag.split(' - ');
  return parts[parts.length - 1];
}

export function getOperationalPointsWithTimes(simulationReport: SimulationReportSheetProps): {
  opId: string;
  positionOnPath: number;
  time: string | null;
  name: string | undefined;
  ch: string | undefined;
  stop: string | null | undefined;
  departureTime: string;
}[] {
  const operationalPoints = simulationReport.pathProperties?.suggestedOperationalPoints || [];
  const { simulation } = simulationReport.stdcmData;

  if (simulation.status !== 'success') {
    throw new Error('Simulation was not successful.');
  }

  const { positions, times } = simulation.final_output;
  const departureTime = extractTime(simulationReport.stdcmData.departure_time);

  // Parse departure time into hours and minutes
  const [departureHour, departureMinute] = departureTime.split(':').map(Number);

  // Function to add minutes to the departure time
  const addMinutesToTime = (baseHour: number, baseMinute: number, minutesToAdd: number): string => {
    const totalMinutes = baseHour * 60 + baseMinute + minutesToAdd;
    const finalHour = Math.floor(totalMinutes / 60) % 24;
    const finalMinutes = totalMinutes % 60;
    return `${String(finalHour).padStart(2, '0')}:${String(finalMinutes).padStart(2, '0')}`;
  };

  const getTimeAtPosition = (
    trainPosition: number,
    trainPositions: number[],
    trainTimes: number[],
    trainDepartureHour: number,
    trainDepartureMinute: number
  ): string | null => {
    const index = trainPositions.findIndex((pos) => pos >= trainPosition);
    if (index === -1) return null;
    const timeInMillis = trainTimes[index];
    const timeInMinutes = Math.floor(timeInMillis / 60000);
    return addMinutesToTime(trainDepartureHour, trainDepartureMinute, timeInMinutes);
  };

  // Map operational points with their positions and times
  const opResults = operationalPoints.map((op) => {
    const formattedTime = getTimeAtPosition(
      op.positionOnPath,
      positions,
      times,
      departureHour,
      departureMinute
    );

    return {
      opId: op.opId,
      positionOnPath: op.positionOnPath,
      time: formattedTime,
      name: op.name,
      ch: op.ch,
      stop: op.stopFor,
      departureTime,
    };
  });

  return opResults;
}
