import { useContext, useEffect, useMemo } from 'react';

import { featureCollection } from '@turf/helpers';
import { uniq } from 'lodash';
import { Layer, Source } from 'react-map-gl/maplibre';

import EditorContext from 'applications/editor/context';
import { getEntities } from 'applications/editor/data/api';
import type { TrackState } from 'applications/editor/tools/rangeEdition/types';
import type { TrackSectionEntity } from 'applications/editor/tools/trackEdition/types';
import type { ExtendedEditorContextType } from 'applications/editor/types';
import { getEditorLayersFromLayersSetting } from 'applications/editor/utils';
import { GeoJSONs } from 'common/Map/Layers';
import { colors } from 'common/Map/theme';
import { useInfraID } from 'common/osrdContext';
import { useAppDispatch } from 'store';

import { PARTS_LAYER_ID } from '../consts';
import type { OpEditionState } from '../types';
import { getPartFeatures } from '../utils';

const OpEditionLayers = () => {
  const dispatch = useAppDispatch();
  const infraID = useInfraID();
  const {
    editorState: {
      issuesSettings,
      mapSettings: { layersSettings, mapStyle },
    },
    renderingFingerprint,
    state: { entity, trackSectionsCache, selectedPartIndex },
    setState,
  } = useContext(EditorContext) as ExtendedEditorContextType<OpEditionState>;

  const partTrackIds = useMemo(
    () => uniq(entity.properties.parts.map((part) => part.track)),
    [entity.properties.parts]
  );

  // Load the parts tracks, with their geometries
  useEffect(() => {
    const missingTrackIds = partTrackIds.filter((id) => !trackSectionsCache[id]);
    if (!infraID || !missingTrackIds.length) return;

    const setTrackStates = (getTrackState: (id: string) => TrackState) =>
      setState((s) => ({
        ...s,
        trackSectionsCache: {
          ...s.trackSectionsCache,
          ...Object.fromEntries(missingTrackIds.map((id) => [id, getTrackState(id)])),
        },
      }));

    setTrackStates(() => ({ type: 'loading' }));
    getEntities<TrackSectionEntity>(infraID, missingTrackIds, 'TrackSection', dispatch)
      .then((tracks) =>
        setTrackStates((id) =>
          tracks[id] ? { type: 'success', track: tracks[id] } : { type: 'error' }
        )
      )
      .catch(() => setTrackStates(() => ({ type: 'error' })));
  }, [infraID, partTrackIds, trackSectionsCache, setState, dispatch]);

  const partFeatures = useMemo(
    () => getPartFeatures(entity, trackSectionsCache),
    [entity, trackSectionsCache]
  );

  return (
    <>
      <GeoJSONs
        colors={colors[mapStyle]}
        layers={getEditorLayersFromLayersSetting(layersSettings)}
        fingerprint={renderingFingerprint}
        layersSettings={layersSettings}
        issuesSettings={issuesSettings}
        isEmphasized={false}
        infraID={infraID}
      />
      <Source type="geojson" data={featureCollection(partFeatures)}>
        <Layer
          type="circle"
          id={PARTS_LAYER_ID}
          paint={{
            'circle-radius': 6,
            'circle-color': '#fff',
            'circle-stroke-color': colors[mapStyle].op.circleBV,
            'circle-stroke-width': 3,
          }}
        />
        <Layer
          type="circle"
          id="op-edition/selected-part"
          filter={['==', ['get', 'partIndex'], selectedPartIndex ?? -1]}
          paint={{
            'circle-radius': 3,
            'circle-color': colors[mapStyle].op.circleBV,
          }}
        />
      </Source>
    </>
  );
};

export default OpEditionLayers;
