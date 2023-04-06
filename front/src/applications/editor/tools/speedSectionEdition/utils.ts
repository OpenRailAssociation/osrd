import { SpeedSectionEntity } from '../../../../types';
import { NEW_ENTITY_ID } from '../../data/utils';

export function getNewSpeedSection(): Partial<SpeedSectionEntity> {
  return {
    type: 'Feature',
    objType: 'SpeedSection',
    properties: {
      id: NEW_ENTITY_ID,
      extensions: {
        lpv_sncf: null,
      },
      track_ranges: [],
      speed_limit_by_tag: {},
    },
  };
}
