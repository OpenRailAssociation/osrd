import along from '@turf/along';
import { feature, lineString, point, type Feature, type LineString } from '@turf/helpers';
import length from '@turf/length';
import lineSliceAlong from '@turf/line-slice-along';
import type { Position } from 'geojson';
import { last, cloneDeep, compact, isEmpty } from 'lodash';
import type { MapLayerMouseEvent } from 'maplibre-gl';

import { NEW_ENTITY_ID } from 'applications/editor/data/utils';
import type { TrackRange, TrackSectionEntity } from 'applications/editor/tools/trackEdition/types';
import {
  approximatePointDistanceForEditoast,
  getHoveredTrackRanges,
  getTrackSectionEntityFromNearestPoint,
} from 'applications/editor/tools/utils';
import type { PartialOrReducer } from 'applications/editor/types';
import type {
  ApplicableDirections,
  GetInfraByInfraIdRoutesTrackRangesApiResponse,
} from 'common/api/osrdEditoastApi';
import { getNearestPoint } from 'utils/mapHelper';

import type {
  ApplicableTrackRange,
  ElectrificationEntity,
  PSLExtension,
  PSLSign,
  PSL_SIGN_TYPE,
  PslSignFeature,
  PslSignInformation,
  RangeEditionState,
  RouteElements,
  SpeedSectionEntity,
  SpeedSectionPslEntity,
  TrackRangeExtremityFeature,
  TrackRangeFeature,
  TrackState,
} from './types';
import { PSL_SIGN_TYPES } from './types';

// Tool functions

export function getNewElectrification(): ElectrificationEntity {
  return {
    type: 'Feature',
    objType: 'Electrification',
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
  const distanceAlongTrack = approximatePointDistanceForEditoast(
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

function getNewPslExtension(
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
        itemType: 'TrackRange',
        rangeIndex,
      }),
      point(track.geometry.coordinates[0], {
        ...properties,
        id: `speedSectionRangeExtremity::${rangeIndex}::${begin}`,
        track: range.track,
        extremity: 'BEGIN',
        itemType: 'TrackRangeExtremity',
        rangeIndex,
      }),
      point(last(track.geometry.coordinates) as Position, {
        ...properties,
        id: `speedSectionRangeExtremity::${rangeIndex}::${end}`,
        track: range.track,
        extremity: 'END',
        itemType: 'TrackRangeExtremity',
        rangeIndex,
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
        itemType: 'TrackRange',
        rangeIndex,
      },
    },
    {
      ...along(track.geometry, adjustedBegin),
      properties: {
        ...properties,
        id: `speedSectionRangeExtremity::${rangeIndex}::${adjustedBegin}`,
        track: range.track,
        extremity: 'BEGIN',
        itemType: 'TrackRangeExtremity',
        rangeIndex,
      },
    },
    {
      ...along(track.geometry, adjustedEnd),
      properties: {
        ...properties,
        id: `speedSectionRangeExtremity::${rangeIndex}::${adjustedEnd}`,
        track: range.track,
        extremity: 'END',
        itemType: 'TrackRangeExtremity',
        rangeIndex,
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
  const { track } = trackState;
  const signPoint = along(
    track,
    (sign.position / track.properties.length) * length(track, { units: 'meters' }),
    {
      units: 'meters',
    }
  );
  signPoint.properties = {
    ...sign,
    itemType: 'PSLSign',
    signIndex,
    signType,
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
  return Boolean(entity.properties?.extensions?.psl_sncf);
}

export function speedSectionIsSpeedRestriction(entity: SpeedSectionEntity): boolean {
  return Boolean(entity.properties?.on_routes);
}

export function isOnModeMove(interactionStateType: string): boolean {
  return ['moveRangeExtremity', 'moveSign'].includes(interactionStateType);
}

export const getObjTypeEdition = (objType: 'SpeedSection' | 'Electrification') =>
  objType === 'SpeedSection' ? 'speed' : 'electrification';

export const getObjTypeAction = (objType: 'SpeedSection' | 'Electrification') =>
  objType === 'SpeedSection' ? 'speed-section' : 'electrification';

export const isNew = (entity: SpeedSectionEntity | ElectrificationEntity) =>
  entity.properties.id === NEW_ENTITY_ID;

export const DEFAULT_EXTRA_TRACK_RANGE_LENGTH = 10;
export const makeSpeedRestrictionTrackRanges = (
  trackRanges: ApplicableTrackRange[],
  switches: string[],
  selectedSwitches: Record<string, object>,
  extraMeters?: boolean
) => {
  const indices = Object.keys(selectedSwitches).map(
    (selectedSwitch) => switches.findIndex((s) => s === selectedSwitch) + 1
  );
  const lowerBound = Math.min(...indices);
  const upperBound = Math.max(...indices);
  const zoneTrackRanges = trackRanges.slice(lowerBound, upperBound);
  let returnedExtra = false;
  if (extraMeters) {
    const extraTrackRange = { ...trackRanges[upperBound] };
    const trackLength = extraTrackRange.end - extraTrackRange.begin;
    if (extraTrackRange.applicable_directions === 'STOP_TO_START') {
      extraTrackRange.begin = trackLength - DEFAULT_EXTRA_TRACK_RANGE_LENGTH;
    } else {
      extraTrackRange.end = extraTrackRange.begin + DEFAULT_EXTRA_TRACK_RANGE_LENGTH;
    }
    zoneTrackRanges.push(extraTrackRange);
    returnedExtra = true;
  }
  const trackRangesWithBothDirections = zoneTrackRanges.map<ApplicableTrackRange>((tr) => ({
    ...tr,
    applicable_directions: 'BOTH' as ApplicableDirections,
  }));
  return { trackRangesWithBothDirections, returnedExtra };
};

function renameDirection(trackRange: TrackRange) {
  const { begin, end, track } = trackRange;
  return {
    begin,
    end,
    track,
    applicable_directions: trackRange.direction,
  };
}

export const makeRouteElements = (
  trackRangesResults: GetInfraByInfraIdRoutesTrackRangesApiResponse,
  routes: string[]
): RouteElements =>
  trackRangesResults.reduce((acc, cur, index) => {
    if (cur.type === 'Computed') {
      const trackRanges = cur.track_ranges.map((trackRange) => renameDirection(trackRange));
      const switches = cur.switches_directions.map((sw) => sw[0]);
      return {
        ...acc,
        [routes[index]]: {
          trackRanges,
          switches,
        },
      };
    }
    return acc;
  }, {});

export const trackRangeKey = (trackRange: ApplicableTrackRange, index: number) =>
  `track-range-${trackRange.track}-${trackRange.begin}-${trackRange.end}-${trackRange.applicable_directions}-${index}`;
