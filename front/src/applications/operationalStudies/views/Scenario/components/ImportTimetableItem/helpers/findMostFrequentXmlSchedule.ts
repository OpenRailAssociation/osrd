import type { PacedTrain } from 'common/api/osrdEditoastApi';

function getRelativeStepsTimeAndNames(pacedTrain: PacedTrain): string {
  const stepsWithRelativeTimesAndNames = pacedTrain.schedule!.map((step) => ({
    ...pacedTrain.path.find((pathStep) => pathStep.id === step.at),
    arrival: step.arrival,
    stop_for: step.stop_for,
  }));

  return JSON.stringify(stepsWithRelativeTimesAndNames);
}

export default function findMostFrequentScheduleInPacedTrain(schedules: PacedTrain[]) {
  const scheduleOccurrences = new Map<string, { count: number; schedule: PacedTrain }>();

  schedules.forEach((schedule) => {
    const relativeSteps = getRelativeStepsTimeAndNames(schedule);
    const entry = scheduleOccurrences.get(relativeSteps);
    if (entry) {
      entry.count += 1;
    } else {
      scheduleOccurrences.set(relativeSteps, { count: 1, schedule });
    }
  });

  let mostFrequent: PacedTrain | null = null;
  let highestCount = 0;

  for (const { count, schedule } of scheduleOccurrences.values()) {
    if (count > highestCount) {
      highestCount = count;
      mostFrequent = schedule;
    }
  }

  return { mostFrequent, highestCount };
}
