import type { PathfindingResultSuccess } from 'common/api/generatedEditoastApi';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import type { StdcmPathStep } from 'reducers/osrdconf/types';
import { addElementAtIndex } from 'utils/array';
import { formatToIsoDate } from 'utils/date';

export const upsertStdcmPathStepsInOPs = (
  ops: SuggestedOP[],
  pathSteps: StdcmPathStep[],
  path: PathfindingResultSuccess
): SuggestedOP[] => {
  let updatedOPs = [...ops];

  pathSteps.forEach((step, i) => {
    const { stopFor, arrival: arrivalDate } = step;
    const arrival = arrivalDate ? formatToIsoDate(arrivalDate) : undefined;
    const stepLocation = step.location;

    if (!stepLocation) {
      return;
    }

    // We check only for pathSteps added by map click
    if ('track' in stepLocation) {
      const positionOnPath = path.path_item_positions[i];

      const formattedStep: SuggestedOP = {
        opId: step.id,
        positionOnPath,
        stopFor,
        arrival,
        ...stepLocation,
      };
      // If it hasn't an uic, the step has been added by map click,
      // we know we have its position on path so we can insert it
      // at the good index in the existing operational points
      const index = updatedOPs.findIndex(
        (op) => positionOnPath !== undefined && op.positionOnPath >= positionOnPath
      );

      // if index === -1, it means that the position on path of the last step is bigger
      // than the last operationnal point position.
      // So we know this pathStep is the destination and we want to add it at the end of the array.
      if (index !== -1) {
        updatedOPs = addElementAtIndex(updatedOPs, index, formattedStep);
      } else {
        updatedOPs.push(formattedStep);
      }
    } else if (step.location && 'uic' in step.location) {
      updatedOPs = updatedOPs.map((op) => {
        if (op.uic === step.location.uic && op.ch === step.secondaryCode) {
          return {
            ...op,
            stopFor,
            arrival,
          };
        }
        return op;
      });
    }
  });
  return updatedOPs;
};
