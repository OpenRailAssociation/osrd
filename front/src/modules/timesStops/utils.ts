import type { TFunction } from 'i18next';

import { matchPathStepAndOp } from 'modules/pathfinding/utils';
import type { SuggestedOP } from 'modules/trainschedule/components/ManageTrainSchedule/types';
import type { PathStep } from 'reducers/osrdconf/types';
import { marginRegExValidation } from 'utils/physics';

import type { PathWaypointColumn } from './types';

// eslint-disable-next-line import/prefer-default-export
export const formatSuggestedViasToRowVias = (
  operationalPoints: SuggestedOP[],
  pathSteps: PathStep[],
  t: TFunction<'timesStops', undefined>,
  startTime?: string
): PathWaypointColumn[] => {
  const formattedOps = [...operationalPoints];

  // If the origin is in the ops and isn't the first operational point, we need
  // to move it to the first position
  const origin = pathSteps[0];
  const originIndexInOps = operationalPoints.findIndex((op) => matchPathStepAndOp(origin, op));
  if (originIndexInOps !== -1) {
    [formattedOps[0], formattedOps[originIndexInOps]] = [
      formattedOps[originIndexInOps],
      formattedOps[0],
    ];
  }

  // Ditto: destination should be last
  const dest = pathSteps[pathSteps.length - 1];
  const destIndexInOps = operationalPoints.findIndex((op) => matchPathStepAndOp(dest, op));
  if (destIndexInOps !== -1) {
    const lastOpIndex = formattedOps.length - 1;
    [formattedOps[lastOpIndex], formattedOps[destIndexInOps]] = [
      formattedOps[destIndexInOps],
      formattedOps[lastOpIndex],
    ];
  }

  return formattedOps.map((op, i) => {
    const pathStep = pathSteps.find((step) => matchPathStepAndOp(step, op));
    const { name } = pathStep || op;
    const { arrival, onStopSignal, stopFor, theoreticalMargin } = pathStep || {};

    const isMarginValid = theoreticalMargin ? marginRegExValidation.test(theoreticalMargin) : true;

    return {
      ...op,
      isMarginValid,
      arrival: i === 0 ? startTime?.substring(11, 19) : arrival,
      onStopSignal: onStopSignal || false,
      name: name || t('waypoint', { id: op.opId }),
      stopFor,
      theoreticalMargin,
    };
  });
};
