import type { PathStepV2 } from 'reducers/osrdconf/types';
import { Duration } from 'utils/duration';

/**
 * Reverses the path steps and strips arrival times. Margins are shifted to correspond to the same 'zones' as before.
 *
 * @param pathSteps - An array of path steps to be reversed.
 * @returns A new array of path steps with reversed order, shifted margins and stripped arrival times.
 */
function reversePathSteps(pathSteps: PathStepV2[]): PathStepV2[] {
  // Reverse start and end of margins, in prevision of reversing the list of path steps
  const newMargins: (string | null)[] = [];
  let prevMargin: string | null;
  pathSteps.forEach((pathStep, index) => {
    // Each margin value is only defined at the start of its margin 'zone'
    // Thus its needs to be pushed to the end of its 'zone', which corresponds to either the start of the next defined margin, or the last step for the last 'zone'
    if (pathStep.theoreticalMargin || index === pathSteps.length - 1) {
      newMargins.push(prevMargin);
      prevMargin = pathStep.theoreticalMargin ?? null;
    } else {
      newMargins.push(null);
    }
  });

  return pathSteps
    .map((pathStep, index): PathStepV2 => {
      const isFirstStepNullStop = index === 0 && pathStep.stopFor === null;
      const isLastStepZeroStop = index === pathSteps.length - 1 && pathStep.stopFor?.ms === 0;
      return {
        ...pathStep,
        arrival: null, // Remove arrival times set as they may become incoherent when reversing
        // We should ensure the first stop has a 0ms stop and the last one has none,
        // before reversing (so the first will have none and the last a 0ms stop after reverse)
        stopFor: isFirstStepNullStop
          ? new Duration({ milliseconds: 0 })
          : isLastStepZeroStop
            ? null
            : pathStep.stopFor,
        theoreticalMargin: newMargins[index] ?? null,
      };
    })
    .reverse();
}

export default reversePathSteps;
