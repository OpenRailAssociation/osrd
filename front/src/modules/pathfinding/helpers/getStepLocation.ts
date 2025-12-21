import type { PathItemLocation } from 'common/api/osrdEditoastApi';
import { mToMm } from 'utils/physics';

const getStepLocation = (step: PathItemLocation): PathItemLocation => {
  if (step.type === 'track_offset') {
    // TODO: step offset should be in mm in the store /!\
    // pathfinding blocks endpoint requires offsets in mm
    return { track: step.track, offset: mToMm(step.offset), type: 'track_offset' };
  }
  if (step.operational_point.type === 'id') {
    return {
      operational_point: {
        operational_point: step.operational_point.operational_point,
        type: 'id',
      },
      track_reference: step.track_reference,
      type: 'operational_point_part_reference',
    };
  }
  if (step.operational_point.type === 'trigram') {
    return {
      operational_point: {
        trigram: step.operational_point.trigram,
        secondary_code: step.operational_point.secondary_code,
        type: 'trigram',
      },
      track_reference: step.track_reference,
      type: 'operational_point_part_reference',
    };
  }
  if (step.operational_point.uic === -1) {
    throw new Error('Invalid UIC');
  }
  return {
    operational_point: {
      uic: step.operational_point.uic,
      secondary_code: step.operational_point.secondary_code,
      type: 'uic',
    },
    track_reference: step.track_reference,
    type: 'operational_point_part_reference',
  };
};

export default getStepLocation;
