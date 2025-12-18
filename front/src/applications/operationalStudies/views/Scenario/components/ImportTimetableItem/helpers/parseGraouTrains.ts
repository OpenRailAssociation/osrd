import type { GraouTrainSchedule } from 'common/api/graouApi';

export function filterInvalidSteps(importedTrainSchedules: GraouTrainSchedule[]): {
  filteredTrains: GraouTrainSchedule[];
  modifiedTrainsNumbers: string[];
} {
  const modifiedTrainsNumbers: string[] = [];

  const filteredTrains = importedTrainSchedules.map((trainSchedule) => {
    const filteredSteps = trainSchedule.steps.filter(
      (step, i) =>
        i === 0 ||
        new Date(step.arrivalTime).getTime() >=
          new Date(trainSchedule.steps[i - 1].departureTime).getTime()
    );
    if (filteredSteps.length < trainSchedule.steps.length) {
      modifiedTrainsNumbers.push(trainSchedule.trainNumber);
    }
    return { ...trainSchedule, steps: filteredSteps };
  });

  return { filteredTrains, modifiedTrainsNumbers };
}

export function updateTrainSchedules(importedTrainSchedules: GraouTrainSchedule[]) {
  // For each train schedule, we add the duration and tracks of each step
  const trainsSchedules = importedTrainSchedules.map((trainSchedule) => {
    const stepsWithDuration = trainSchedule.steps.map((step) => {
      // calcul duration in seconds between step arrival and departure
      // in case of arrival and departure are the same, we set duration to 0
      // for the step arrivalTime is before departureTime because the train first goes to the station and then leaves it
      const duration = Math.round(
        (new Date(step.departureTime).getTime() - new Date(step.arrivalTime).getTime()) / 1000
      );
      return {
        ...step,
        duration,
      };
    });
    return {
      ...trainSchedule,
      steps: stepsWithDuration,
    };
  });

  return trainsSchedules;
}
