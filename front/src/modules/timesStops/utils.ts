import type { TFunction } from 'i18next';

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
  let formattedOps = [...operationalPoints];
  const origin = pathSteps[0] as PathStep;
  if ('uic' in origin && 'ch' in origin) {
    const originIndexInOps = operationalPoints.findIndex(
      (op) => op.uic === origin.uic && op.ch === origin.ch && op.name === origin.name
    );
    // If the origin is in the ops and isn't the first operational point, we need to move it to the first position
    if (originIndexInOps !== (-1 || 0)) {
      formattedOps = formattedOps.toSpliced(originIndexInOps, 1);
      formattedOps.unshift(operationalPoints[originIndexInOps]);
    }
  }
  return formattedOps.map((op, i) => {
    const isMarginValid = op.theoreticalMargin
      ? marginRegExValidation.test(op.theoreticalMargin)
      : true;

    const correspondingOp = !('uic' in op)
      ? pathSteps.find((step) => step.id === op.opId)
      : undefined;

    const { arrival, onStopSignal, name } = correspondingOp || op;

    return {
      ...op,
      isMarginValid,
      arrival: i === 0 ? startTime?.substring(11, 19) : arrival,
      onStopSignal: onStopSignal || false,
      name: name || t('waypoint', { id: op.opId }),
      ...(correspondingOp && {
        stopFor: correspondingOp.stopFor,
        theoreticalMargin: correspondingOp.theoreticalMargin,
      }),
    };
  });
};
