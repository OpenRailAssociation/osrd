import type { PathStep } from 'reducers/osrdconf/types';

/**
 * Reverses the path steps and strips arrival times. Margins are shifted to correspond to the same 'zones' as before.
 *
 * @param pathSteps - An array of path steps to be reversed.
 * @returns A new array of path steps with reversed order, shifted margins and stripped arrival times.
 */
function reversePathSteps(pathSteps: PathStep[]): PathStep[] {
  // Reverse start and end of margins, in prevision of reversing the list of path steps
  const newMargins: (string | undefined)[] = [];
  let prevMargin: string | undefined;
  pathSteps.forEach((pathStep, index) => {
    // Each margin value is only defined at the start of its margin 'zone'
    // Thus its needs to be pushed to the end of its 'zone', which corresponds to either the start of the next defined margin, or the last step for the last 'zone'
    if (pathStep.theoreticalMargin || index === pathSteps.length - 1) {
      newMargins.push(prevMargin);
      prevMargin = pathStep.theoreticalMargin;
    } else {
      newMargins.push(undefined);
    }
  });

  return pathSteps
    .map((pathStep, index) => {
      const isLastStepZeroStop = index === pathSteps.length - 1 && pathStep.stopFor?.ms === 0;
      return {
        ...pathStep,
        arrival: null, // Remove arrival times set as they may become incoherent when reversing
        stopFor: isLastStepZeroStop ? null : pathStep.stopFor, // We automatically insert a 0ms stop on the last step, which should be dropped before reversing
        theoreticalMargin: newMargins[index],
      };
    })
    .reverse();
}

export default reversePathSteps;
