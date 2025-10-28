import type { PathItemLocation } from 'common/api/osrdEditoastApi';
import { mToMm } from 'utils/physics';

const getStepLocation = (step: PathItemLocation): PathItemLocation => {
  if ('track' in step) {
    // TODO: step offset should be in mm in the store /!\
    // pathfinding blocks endpoint requires offsets in mm
    return { track: step.track, offset: mToMm(step.offset) };
  }
  if ('operational_point' in step.reference) {
    return {
      reference: {
        operational_point: step.reference.operational_point,
      },
      track_reference: step.track_reference,
    };
  }
  if ('trigram' in step.reference) {
    return {
      reference: {
        trigram: step.reference.trigram,
        secondary_code: step.reference.secondary_code,
      },
      track_reference: step.track_reference,
    };
  }
  if (step.reference.uic === -1) {
    throw new Error('Invalid UIC');
  }
  return {
    reference: {
      uic: step.reference.uic,
      secondary_code: step.reference.secondary_code,
    },
    track_reference: step.track_reference,
  };
};

export default getStepLocation;
