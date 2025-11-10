import type { PathItemLocation } from 'common/api/osrdEditoastApi';
import { mToMm } from 'utils/physics';

const getStepLocation = (step: PathItemLocation): PathItemLocation => {
  if ('track' in step) {
    // TODO: step offset should be in mm in the store /!\
    // pathfinding blocks endpoint requires offsets in mm
    return { track: step.track, offset: mToMm(step.offset) };
  }
  if ('operational_point' in step.operational_point) {
    return {
      operational_point: {
        operational_point: step.operational_point.operational_point,
      },
      track_reference: step.track_reference,
    };
  }
  if ('trigram' in step.operational_point) {
    return {
      operational_point: {
        trigram: step.operational_point.trigram,
        secondary_code: step.operational_point.secondary_code,
      },
      track_reference: step.track_reference,
    };
  }
  if (step.operational_point.uic === -1) {
    throw new Error('Invalid UIC');
  }
  return {
    operational_point: {
      uic: step.operational_point.uic,
      secondary_code: step.operational_point.secondary_code,
    },
    track_reference: step.track_reference,
  };
};

export default getStepLocation;
