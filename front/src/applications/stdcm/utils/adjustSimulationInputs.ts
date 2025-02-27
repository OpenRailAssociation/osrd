import dayjs from 'dayjs';

import type { PostTimetableByIdStdcmApiArg } from 'common/api/osrdEditoastApi';
import { isoDateToMs } from 'utils/date';
import { Duration } from 'utils/duration';

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

      const {
        arrival_time,
        arrival_time_tolerance_before: beforeTolerance,
        arrival_time_tolerance_after: afterTolerance,
      } = step.timing_data;

      const timingData =
        direction === 'upstream'
          ? {
              arrival_time: new Date(isoDateToMs(arrival_time) + afterTolerance).toISOString(),
              arrival_time_tolerance_before: 0,
              arrival_time_tolerance_after: afterTolerance,
            }
          : {
              arrival_time: new Date(isoDateToMs(arrival_time) - beforeTolerance).toISOString(),
              arrival_time_tolerance_before: beforeTolerance,
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

    const toleranceBeforeMs = step.tolerances.before.valueOf();
    const toleranceAfterMs = step.tolerances.after.valueOf();

    const adjustedProps =
      direction === 'upstream'
        ? {
            arrival: dayjs(step.arrival).add(toleranceAfterMs, 'millisecond').toDate(),
            tolerances: { before: new Duration({ seconds: 0 }), after: step.tolerances.after },
          }
        : {
            arrival: dayjs(step.arrival).subtract(toleranceBeforeMs, 'millisecond').toDate(),
            tolerances: { before: step.tolerances.before, after: new Duration({ seconds: 0 }) },
          };

    return {
      ...step,
      ...adjustedProps,
    };
  });
  return { ...simulationInputs, pathSteps: adjustedPathSteps };
};
