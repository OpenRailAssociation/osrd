import type { ImportedTrainSchedule } from 'applications/operationalStudies/types';
import { Duration } from 'utils/duration';

export function getRelativeStepsTimeAndNames(trainSchedule: ImportedTrainSchedule): string {
  const departureTime = new Date(trainSchedule.departureTime);

  const stepsWithRelativeTimesAndNames = trainSchedule.steps.map((step) => {
    const arrival = new Date(step.arrivalTime);
    const departure = new Date(step.departureTime);
    return {
      name: step.uic || step.trigram,
      relativeArrivalSeconds: Math.round(
        Duration.subtractDate(arrival, departureTime).total('second')
      ),
      relativeDepartureSeconds: Math.round(
        Duration.subtractDate(departure, departureTime).total('second')
      ),
    };
  });

  return JSON.stringify(stepsWithRelativeTimesAndNames);
}

export function findMostFrequentScheduleInPacedTrain(schedules: ImportedTrainSchedule[]) {
  const scheduleOccurrences = new Map<string, { count: number; schedule: ImportedTrainSchedule }>();

  schedules.forEach((schedule) => {
    const relativeSteps = getRelativeStepsTimeAndNames(schedule);
    const entry = scheduleOccurrences.get(relativeSteps);
    if (entry) {
      entry.count += 1;
    } else {
      scheduleOccurrences.set(relativeSteps, { count: 1, schedule });
    }
  });

  let mostFrequent: ImportedTrainSchedule | null = null;
  let highestCount = 0;

  for (const { count, schedule } of scheduleOccurrences.values()) {
    if (count > highestCount) {
      highestCount = count;
      mostFrequent = schedule;
    }
  }

  return { mostFrequent, highestCount };
}
