import { Position } from 'geojson';
import { last, cloneDeep, compact, isEmpty } from 'lodash';
import along from '@turf/along';
import length from '@turf/length';
import { Feature, feature, lineString, LineString, point } from '@turf/helpers';
import lineSliceAlong from '@turf/line-slice-along';
import { MapLayerMouseEvent } from 'maplibre-gl';

import { getNearestPoint } from 'utils/mapHelper';
import { NEW_ENTITY_ID } from '../../data/utils';
import {
  CatenaryEntity,
  PSLExtension,
  PSLSign,
  SpeedSectionEntity,
  SpeedSectionPslEntity,
  TrackRange,
  TrackSectionEntity,
} from '../../../../types';
import {
  PSL_SIGN_TYPE,
  PSL_SIGN_TYPES,
  PslSignFeature,
  PslSignInformation,
  RangeEditionState,
  TrackRangeExtremityFeature,
  TrackRangeFeature,
  TrackState,
} from './types';
import {
  approximateDistanceWithEditoastData,
  getHoveredTrackRanges,
  getTrackSectionEntityFromNearestPoint,
} from '../utils';
import { DEFAULT_COMMON_TOOL_STATE } from '../commonToolState';
import { PartialOrReducer } from '../editorContextTypes';

// Tool functions

export function getNewCatenary(): CatenaryEntity {
  return {
    type: 'Feature',
    objType: 'Catenary',
    properties: {
      id: NEW_ENTITY_ID,
      track_ranges: [],
      voltage: '',
    },
    geometry: {
      type: 'MultiLineString',
      coordinates: [],
    },
  };
}

/**
 * Given a hover event and a trackSectionCache when moving a PslSign, return the new position of the sign, with the trackRange's id on which the sign is and its distance from the beginning of the trackRange.
 * - retrieve the trackRanges around the mouse
 * - retrieve the nearest point of the mouse (and the trackRange it belongs to)
 * - compute the distance between the beginning of the track and the nearest point (with approximation because of Editoast data)
 */

export function getPslSignNewPosition(
  e: MapLayerMouseEvent,
  trackSectionsCache: Record<string, TrackState>
) {
  const hoveredTrackRanges = getHoveredTrackRanges(e);
  if (isEmpty(hoveredTrackRanges)) {
    return null;
  }
  const nearestPoint = getNearestPoint(hoveredTrackRanges, e.lngLat.toArray());
  const trackSection = getTrackSectionEntityFromNearestPoint(
    nearestPoint,
    hoveredTrackRanges,
    trackSectionsCache
  );
  if (!trackSection) {
    return null;
  }
  const distanceAlongTrack = approximateDistanceWithEditoastData(
    trackSection,
    nearestPoint.geometry
  );
  return { track: trackSection.properties.id, position: distanceAlongTrack };
}

export function getNewSpeedSection(): SpeedSectionEntity {
  return {
    type: 'Feature',
    objType: 'SpeedSection',
    properties: {
      id: NEW_ENTITY_ID,
      extensions: {
        psl_sncf: null,
      },
      track_ranges: [],
      speed_limit_by_tag: {},
    },
    geometry: {
      type: 'MultiLineString',
      coordinates: [],
    },
  };
}

/** return the PSL sign type and its index (if the sign is not a Z sign) */
export function getSignInformationFromInteractionState(
  interactionState: { type: 'moveSign' } & PslSignInformation
) {
  const { signType } = interactionState;
  return (
    signType === PSL_SIGN_TYPES.Z
      ? { signType: PSL_SIGN_TYPES.Z }
      : { signType, signIndex: interactionState.signIndex }
  ) as PslSignInformation;
}

export function getNewPslExtension(
  newPslExtension: PSLExtension,
  signInformation: PslSignInformation,
  newPosition: { track: string; position: number }
) {
  const { signType } = signInformation;
  if (signType === PSL_SIGN_TYPES.Z) {
    newPslExtension.z = {
      ...newPslExtension.z,
      ...newPosition,
    };
  } else {
    const { signIndex } = signInformation;
    if (signType === PSL_SIGN_TYPES.ANNOUNCEMENT) {
      newPslExtension.announcement[signIndex] = {
        ...newPslExtension.announcement[signIndex],
        ...newPosition,
      };
    } else {
      newPslExtension.r[signIndex] = {
        ...newPslExtension.r[signIndex],
        ...newPosition,
      };
    }
  }
  return newPslExtension;
}

export function getMovedPslEntity(
  entity: SpeedSectionPslEntity,
  signInfo: PslSignInformation,
  newPosition: { track: string; position: number }
) {
  const newPslExtension = getNewPslExtension(
    cloneDeep(entity.properties.extensions.psl_sncf),
    signInfo,
    newPosition
  );
  const updatedEntity = cloneDeep(entity);
  updatedEntity.properties.extensions.psl_sncf = newPslExtension;
  return updatedEntity;
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
  };
}

export function getEditCatenaryState(entity: CatenaryEntity): RangeEditionState<CatenaryEntity> {
  return {
    ...DEFAULT_COMMON_TOOL_STATE,
    initialEntity: cloneDeep(entity),
    entity: cloneDeep(entity),
    trackSectionsCache: {},
    interactionState: { type: 'idle' },
    hoveredItem: null,
  };
}

export function getTrackRangeFeatures(
  track: TrackSectionEntity,
  range: Pick<TrackRange, 'begin' | 'end' | 'track'>,
  rangeIndex: number,
  properties: Record<string, unknown>
): [TrackRangeFeature, TrackRangeExtremityFeature, TrackRangeExtremityFeature] {
  const dataLength = track.properties.length;
  const begin = Math.max(Math.min(range.begin, range.end), 0);
  const end = Math.min(Math.max(range.begin, range.end), dataLength);

  if (begin <= 0 && end >= dataLength)
    return [
      feature(track.geometry, {
        ...properties,
        ...range,
        id: `speedSectionRangeExtremity::${rangeIndex}::${begin}::${end}`,
        speedSectionItemType: 'TrackRange',
        speedSectionRangeIndex: rangeIndex,
      }),
      point(track.geometry.coordinates[0] as Position, {
        ...properties,
        id: `speedSectionRangeExtremity::${rangeIndex}::${begin}`,
        track: range.track,
        extremity: 'BEGIN',
        speedSectionItemType: 'TrackRangeExtremity',
        speedSectionRangeIndex: rangeIndex,
      }),
      point(last(track.geometry.coordinates) as Position, {
        ...properties,
        id: `speedSectionRangeExtremity::${rangeIndex}::${end}`,
        track: range.track,
        extremity: 'END',
        speedSectionItemType: 'TrackRangeExtremity',
        speedSectionRangeIndex: rangeIndex,
      }),
    ];

  // Since Turf and Editoast do not compute the lengths the same way (see #1751)
  // we can have data "end" being larger than Turf's computed length, which
  // throws an error. Until we find a way to get similar computations, we can
  // approximate this way:
  const computedLength = length(track);
  const adjustedBegin = Math.max((begin * computedLength) / dataLength, 0);
  const adjustedEnd = Math.min((end * computedLength) / dataLength, computedLength);

  let line: Feature<LineString>;
  // See https://github.com/Turfjs/turf/issues/1577 for this issue:
  if (adjustedBegin === adjustedEnd) {
    const { coordinates } = along(track.geometry, adjustedBegin).geometry;
    line = lineString([coordinates, coordinates]);
  } else {
    line = lineSliceAlong(track.geometry, adjustedBegin, adjustedEnd);
  }

  return [
    {
      ...line,
      properties: {
        ...properties,
        ...range,
        id: `speedSectionRangeExtremity::${rangeIndex}::${adjustedBegin}::${adjustedEnd}`,
        speedSectionItemType: 'TrackRange',
        speedSectionRangeIndex: rangeIndex,
      },
    },
    {
      ...along(track.geometry, adjustedBegin),
      properties: {
        ...properties,
        id: `speedSectionRangeExtremity::${rangeIndex}::${adjustedBegin}`,
        track: range.track,
        extremity: 'BEGIN',
        speedSectionItemType: 'TrackRangeExtremity',
        speedSectionRangeIndex: rangeIndex,
      },
    },
    {
      ...along(track.geometry, adjustedEnd),
      properties: {
        ...properties,
        id: `speedSectionRangeExtremity::${rangeIndex}::${adjustedEnd}`,
        track: range.track,
        extremity: 'END',
        speedSectionItemType: 'TrackRangeExtremity',
        speedSectionRangeIndex: rangeIndex,
      },
    },
  ];
}

/**
 * Given a PSL sign and the cached trackSections, generate a point feature to represent a SpeedSection Psl Sign.
 * If the sign's track is not in the trackSectionsCache object, then return null.
 * This feature will be used to display the sign on the map.
 */
function generatePointFromPSLSign(
  sign: PSLSign,
  signIndex: number,
  signType: PSL_SIGN_TYPE,
  trackSectionsCache: Record<string, TrackState>
): PslSignFeature | null {
  const trackState = trackSectionsCache[sign.track];
  if (trackState?.type !== 'success') {
    return null;
  }
  const track = trackState.track;
  const signPoint = along(
    track,
    (sign.position / track.properties.length) * length(track, { units: 'meters' }),
    {
      units: 'meters',
    }
  );
  signPoint.properties = {
    ...sign,
    speedSectionItemType: 'PSLSign',
    speedSectionSignIndex: signIndex,
    speedSectionSignType: signType,
  };
  return signPoint as PslSignFeature;
}

/**
 * Given a PSL extension and cached trackSections, generate an array of Point Features to display the PSL signs on the map.
 */
export function generatePslSignFeatures(
  psl: PSLExtension,
  trackSectionsCache: Record<string, TrackState>
) {
  const signsLists = [
    { type: PSL_SIGN_TYPES.Z, signs: psl.z ? [psl.z] : [] },
    { type: PSL_SIGN_TYPES.R, signs: psl.r },
    { type: PSL_SIGN_TYPES.ANNOUNCEMENT, signs: psl.announcement },
  ];
  const signPoints = signsLists.flatMap(({ type, signs }) =>
    signs.map((sign, i) => generatePointFromPSLSign(sign, i, type, trackSectionsCache))
  );
  return compact(signPoints);
}

export function getPointAt(track: TrackSectionEntity, at: number): Position {
  const dataLength = track.properties.length;
  if (at <= 0) return track.geometry.coordinates[0];
  if (at >= dataLength) return last(track.geometry.coordinates) as Position;

  const computedLength = length(track);
  return along(track.geometry, (at * computedLength) / dataLength).geometry.coordinates;
}

export function msToKmh(v: number): number {
  return v * 3.6;
}
export function kmhToMs(v: number): number {
  return v / 3.6;
}

/**
 * Given a pslSign information, update the state to notify that the user is moving the sign.
 * - set the interaction state on 'moveSign'
 * - store in the interaction state the sign informations
 */
export function selectPslSign(
  pslSign: PslSignInformation,
  setState: (stateOrReducer: PartialOrReducer<RangeEditionState<SpeedSectionEntity>>) => void
) {
  const { signType } = pslSign;
  const interactionState =
    signType === PSL_SIGN_TYPES.Z
      ? ({ type: 'moveSign', signType: PSL_SIGN_TYPES.Z } as {
          type: 'moveSign';
          signType: PSL_SIGN_TYPES.Z;
        })
      : ({
          type: 'moveSign',
          signType,
          signIndex: pslSign.signIndex,
        } as {
          type: 'moveSign';
          signType: PSL_SIGN_TYPES.ANNOUNCEMENT | PSL_SIGN_TYPES.R;
          signIndex: number;
        });
  setState({
    hoveredItem: null,
    interactionState,
  });
}

export function speedSectionIsPsl(entity: SpeedSectionEntity): boolean {
  return !!entity.properties?.extensions?.psl_sncf;
}

export function isOnModeMove(interactionStateType: string): boolean {
  return ['moveRangeExtremity', 'moveSign'].includes(interactionStateType);
}

export const getObjTypeEdition = (objType: 'SpeedSection' | 'Catenary') =>
  objType === 'SpeedSection' ? 'speed' : 'catenary';

export const getObjTypeAction = (objType: 'SpeedSection' | 'Catenary') =>
  objType === 'SpeedSection' ? 'speed-section' : 'catenary';
