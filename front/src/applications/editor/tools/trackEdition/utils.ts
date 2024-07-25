import { cloneDeep } from 'lodash';

import { DEFAULT_COMMON_TOOL_STATE } from 'applications/editor/tools/consts';
import type {
  ElectrificationEntity,
  RangeEditionState,
  SpeedSectionEntity,
} from 'applications/editor/tools/rangeEdition/types';
import type { EditorEntity } from 'applications/editor/typesEditorEntity';
import type { LinearMetadataItem } from 'common/IntervalsDataViz/types';

import type { TrackEditionState } from './types';
import { getNewLine } from '../utils';

export function getInitialState(): TrackEditionState {
  const track = getNewLine([]);

  return {
    ...DEFAULT_COMMON_TOOL_STATE,
    anchorLinePoints: true,
    addNewPointsAtStart: false,
    nearestPoint: null,
    track,
    initialTrack: track,
    editionState: { type: 'addPoint' },
  };
}

export function injectGeometry(track: EditorEntity): EditorEntity {
  return {
    ...track,
    properties: {
      ...(track.properties || {}),
      geo: track.geometry,
    },
  };
}

/**
 * Remove the invalid ranges when the length of the track section has been modified
 * - keep ranges if begin is undefined in case we just added a new one or if we deleted the begin input value
 * - remove ranges which start after the new end
 * - cut the ranges which start before the new end but end after it
 */
export function removeInvalidRanges<T>(values: LinearMetadataItem<T>[], newLength: number) {
  return values
    .filter((item) => item.begin < newLength || item.begin === undefined)
    .map((item) => (item.end >= newLength ? { ...item, end: newLength } : item));
}

export function getEditSpeedSectionState(
  entity: SpeedSectionEntity
): RangeEditionState<SpeedSectionEntity> {
  return {
    ...DEFAULT_COMMON_TOOL_STATE,
    initialEntity: cloneDeep(entity),
    entity: cloneDeep(entity),
    trackSectionsCache: {},
    interactionState: { type: 'idle' },
    hoveredItem: null,
    selectedTrackNodes: {},
    highlightedRoutes: [],
    routeElements: {},
  };
}

export function getEditElectrificationState(
  entity: ElectrificationEntity
): RangeEditionState<ElectrificationEntity> {
  return {
    ...DEFAULT_COMMON_TOOL_STATE,
    initialEntity: cloneDeep(entity),
    entity: cloneDeep(entity),
    trackSectionsCache: {},
    interactionState: { type: 'idle' },
    hoveredItem: null,
    selectedTrackNodes: {},
    highlightedRoutes: [],
    routeElements: {},
  };
}
