import { isNumber } from 'lodash';

import type { TrackSectionEntity } from 'applications/editor/tools/trackEdition/types';

// eslint-disable-next-line import/prefer-default-export
export function isOffsetValid(offset: unknown, track: TrackSectionEntity): boolean {
  const trackLength = track.properties.length;
  return isNumber(offset) && offset > 0 && offset / 1000 < trackLength;
}
