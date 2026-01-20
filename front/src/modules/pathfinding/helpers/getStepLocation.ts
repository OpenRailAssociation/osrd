import type { PathItemLocation } from 'common/api/osrdEditoastApi';

const getStepLocation = (step: PathItemLocation): PathItemLocation => {
  if ('track' in step) {
    return { track: step.track, offset: step.offset };
  }
  if (step.operational_point.type === 'id') {
    return {
      operational_point: {
        operational_point: step.operational_point.operational_point,
        type: 'id',
      },
      local_track_name: step.local_track_name,
    };
  }
  if (step.operational_point.type === 'trigram') {
    return {
      operational_point: {
        trigram: step.operational_point.trigram,
        secondary_code: step.operational_point.secondary_code,
        type: 'trigram',
      },
      local_track_name: step.local_track_name,
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
    local_track_name: step.local_track_name,
  };
};

export default getStepLocation;
