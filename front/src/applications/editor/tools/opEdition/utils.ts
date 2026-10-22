import { point } from '@turf/helpers';
import type { MapGeoJSONFeature } from 'maplibre-gl';

import { NEW_ENTITY_ID } from 'applications/editor/data/utils';
import { DEFAULT_COMMON_TOOL_STATE } from 'applications/editor/tools/consts';
import type { TrackState } from 'applications/editor/tools/rangeEdition/types';
import { getPointAt } from 'applications/editor/tools/rangeEdition/utils';
import type { OperationalPointPart } from 'common/api/osrdEditoastApi';
import { NULL_GEOMETRY } from 'types';

import { PARTS_LAYER_ID } from './consts';
import type { OpEditionState, OpEntity, OpPartFeature } from './types';

export function getEmptyOp(): OpEntity {
  return {
    type: 'Feature',
    objType: 'OperationalPoint',
    geometry: NULL_GEOMETRY,
    properties: {
      id: NEW_ENTITY_ID,
      name: '',
      country_code: '',
      main_code: '',
      is_passenger_station: false,
      parts: [],
    },
  };
}

export function getOpEditionState(entity?: OpEntity): OpEditionState {
  const op = entity ?? getEmptyOp();
  return {
    ...DEFAULT_COMMON_TOOL_STATE,
    entity: op,
    initialEntity: op,
    trackSectionsCache: {},
    interactionState: { type: 'idle' },
    hoveredPartIndex: null,
    selectedPartIndex: null,
  };
}

export function isNewOp(entity: OpEntity): boolean {
  return entity.properties.id === NEW_ENTITY_ID;
}

export function canSaveOp({ properties }: OpEntity): boolean {
  return (
    !!properties.name &&
    !!properties.country_code &&
    !!properties.main_code &&
    properties.parts.length > 0 &&
    // Editoast rejects blank local track names
    properties.parts.every((part) => !!part.local_track_name.trim())
  );
}

// Returns the part index if the feature is a rendered part, null otherwise
export function getFeaturePartIndex(feature?: MapGeoJSONFeature): number | null {
  if (feature?.layer.id !== PARTS_LAYER_ID) return null;
  const { partIndex } = feature.properties;
  return typeof partIndex === 'number' ? partIndex : null;
}

export function getPartFeatures(
  entity: OpEntity,
  trackSectionsCache: Record<string, TrackState>
): OpPartFeature[] {
  return entity.properties.parts.flatMap((part, partIndex) => {
    const trackState = trackSectionsCache[part.track];
    if (trackState?.type !== 'success') return [];
    return [
      point(getPointAt(trackState.track, part.position), {
        partIndex,
        track: part.track,
      }),
    ];
  });
}

function updateParts(entity: OpEntity, parts: OperationalPointPart[]): OpEntity {
  return { ...entity, properties: { ...entity.properties, parts } };
}

export function addPart(entity: OpEntity, track: string, position: number): OpEntity {
  return updateParts(entity, [
    ...entity.properties.parts,
    { track, position, local_track_name: '' },
  ]);
}

export function removePart(entity: OpEntity, partIndex: number): OpEntity {
  return updateParts(
    entity,
    entity.properties.parts.filter((_, i) => i !== partIndex)
  );
}

export function updatePart(
  entity: OpEntity,
  partIndex: number,
  patch: Partial<OperationalPointPart>
): OpEntity {
  return updateParts(
    entity,
    entity.properties.parts.map((part, i) => (i === partIndex ? { ...part, ...patch } : part))
  );
}
