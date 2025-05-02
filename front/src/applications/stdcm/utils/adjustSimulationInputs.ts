import type { PostTimetableByIdStdcmApiArg } from 'common/api/osrdEditoastApi';
import { Duration, addDurationToDate, subtractDurationFromDate } from 'utils/duration';

import type { StdcmSimulationInputs } from '../types';

/**
 * Adjusts a step's arrival time based on its own tolerance values and the given direction.
 *
 * @param payload - The step containing timing data.
 * @param direction - 'upstream' or 'downstream'
 * @returns The updated step with adjusted arrival time and tolerances.
 */
export const adjustPayloadByDirection = (
  payload: PostTimetableByIdStdcmApiArg,
  direction: 'upstream' | 'downstream'
): PostTimetableByIdStdcmApiArg => ({
  ...payload,
  body: {
    ...payload.body,
    steps: payload.body.steps.map((step, index, steps) => {
      if (index !== 0 && index !== steps.length - 1) return step;
      if (!step.timing_data) return step;

      const arrivalTime = new Date(step.timing_data.arrival_time);
      const toleranceBefore = new Duration({
        milliseconds: step.timing_data.arrival_time_tolerance_before,
      });
      const toleranceAfter = new Duration({
        milliseconds: step.timing_data.arrival_time_tolerance_after,
      });

      const timingData =
        direction === 'upstream'
          ? {
              arrival_time: addDurationToDate(arrivalTime, toleranceAfter).toISOString(),
              arrival_time_tolerance_before: 0,
              arrival_time_tolerance_after: toleranceAfter.ms,
            }
          : {
              arrival_time: subtractDurationFromDate(arrivalTime, toleranceBefore).toISOString(),
              arrival_time_tolerance_before: toleranceBefore.ms,
              arrival_time_tolerance_after: 0,
            };
      return {
        ...step,
        timing_data: timingData,
      };
    }),
  },
});

/**
 * Adjusts the pathSteps of an input step based on the specified direction.
 * For "upstream", it sets the "before" tolerance to zero and keeps the "after" tolerance.
 * For "downstream", it sets the "after" tolerance to zero and keeps the "before" tolerance.
 *
 * @param simulationInputs - The original simulation inputs containing the pathSteps.
 * @param direction - The direction, either "upstream" or "downstream".
 * @returns The updated step with adjusted tolerances and arrival.
 */
export const adjustInputByDirection = (
  simulationInputs: StdcmSimulationInputs,
  direction: 'upstream' | 'downstream'
): StdcmSimulationInputs => {
  const adjustedPathSteps = simulationInputs.pathSteps.map((step) => {
    if (step.isVia || !step.arrival || !step.tolerances) return step;

    const adjustedProps =
      direction === 'upstream'
        ? {
            arrival: addDurationToDate(step.arrival, step.tolerances.after),
            tolerances: { before: new Duration({ seconds: 0 }), after: step.tolerances.after },
          }
        : {
            arrival: subtractDurationFromDate(step.arrival, step.tolerances.before),
            tolerances: { before: step.tolerances.before, after: new Duration({ seconds: 0 }) },
          };

    return {
      ...step,
      ...adjustedProps,
    };
  });
  return { ...simulationInputs, pathSteps: adjustedPathSteps };
};
