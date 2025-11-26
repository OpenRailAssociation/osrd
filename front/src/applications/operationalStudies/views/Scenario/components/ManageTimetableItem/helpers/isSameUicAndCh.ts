import type { PathStep } from 'reducers/osrdconf/types';

export const isSameUicAndCh = (a: PathStep, b: PathStep) => {
  const prevOp =
    'operational_point' in a.location && a.location.operational_point
      ? a.location.operational_point
      : undefined;
  const currOp =
    'operational_point' in b.location && b.location.operational_point
      ? b.location.operational_point
      : undefined;
  if (!prevOp || !currOp) return false;

  const sameUic = 'uic' in prevOp && 'uic' in currOp && prevOp.uic === currOp.uic;
  const sameSecondaryCode =
    'secondary_code' in prevOp &&
    'secondary_code' in currOp &&
    prevOp.secondary_code === currOp.secondary_code;

  return sameUic && sameSecondaryCode;
};
