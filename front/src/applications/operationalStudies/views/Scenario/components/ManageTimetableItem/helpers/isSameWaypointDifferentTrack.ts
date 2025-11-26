import type { PathStep } from 'reducers/osrdconf/types';

export const isSameWaypointDifferentTrack = (a: PathStep, b: PathStep) => {
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
  const prevTrack =
    'track_reference' in a.location && a.location.track_reference
      ? a.location.track_reference
      : undefined;
  const currTrack =
    'track_reference' in b.location && b.location.track_reference
      ? b.location.track_reference
      : undefined;
  const differentTrack =
    prevTrack &&
    'track_name' in prevTrack &&
    currTrack &&
    'track_name' in currTrack &&
    prevTrack.track_name !== currTrack.track_name;

  return sameUic && sameSecondaryCode && differentTrack;
};
