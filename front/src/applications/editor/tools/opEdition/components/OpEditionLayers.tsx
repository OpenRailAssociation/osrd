import { useContext, useEffect, useMemo } from 'react';

import { featureCollection } from '@turf/helpers';
import { uniq } from 'lodash';
import type { ExpressionSpecification } from 'maplibre-gl';
import { useTranslation } from 'react-i18next';
import { Layer, Popup, Source } from 'react-map-gl/maplibre';

import EntitySumUp from 'applications/editor/components/EntitySumUp';
import EditorContext from 'applications/editor/context';
import { getEntities } from 'applications/editor/data/api';
import type { TrackState } from 'applications/editor/tools/rangeEdition/types';
import type { TrackSectionEntity } from 'applications/editor/tools/trackEdition/types';
import type { ExtendedEditorContextType } from 'applications/editor/types';
import { getEditorLayersFromLayersSetting } from 'applications/editor/utils';
import { LoaderFill } from 'common/Loaders';
import { GeoJSONs } from 'common/Map/Layers';
import { colors } from 'common/Map/theme';
import { useInfraID } from 'common/osrdContext';
import { useAppDispatch } from 'store';

import { PARTS_LAYER_ID } from '../consts';
import type { OpEditionState } from '../types';
import { getPartFeatures } from '../utils';

const OpEditionLayers = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const infraID = useInfraID();
  const {
    editorState: {
      issuesSettings,
      mapSettings: { layersSettings, mapStyle },
    },
    renderingFingerprint,
    state: {
      entity,
      trackSectionsCache,
      hovered,
      hoveredPartIndex,
      selectedPartIndex,
      interactionState,
      mousePosition,
    },
    setState,
  } = useContext(EditorContext) as ExtendedEditorContextType<OpEditionState>;

  const isMoving = interactionState.type === 'movePart';
  const hoveredTrackId = hovered?.type === 'TrackSection' ? hovered.id : null;
  const hoveredTrackState = hoveredTrackId ? trackSectionsCache[hoveredTrackId] : undefined;
  const partTrackIds = useMemo(
    () => uniq(entity.properties.parts.map((part) => part.track)),
    [entity.properties.parts]
  );

  // Load the parts tracks and the hovered track, with their geometries
  useEffect(() => {
    const missingTrackIds = uniq(
      hoveredTrackId ? [...partTrackIds, hoveredTrackId] : partTrackIds
    ).filter((id) => !trackSectionsCache[id]);
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
  }, [infraID, partTrackIds, hoveredTrackId, trackSectionsCache, setState, dispatch]);

  const partFeatures = useMemo(
    () => getPartFeatures(entity, trackSectionsCache),
    [entity, trackSectionsCache]
  );
  const highlightedPartIndex = isMoving ? interactionState.partIndex : hoveredPartIndex;
  const isHighlightedPart: ExpressionSpecification = [
    '==',
    ['get', 'partIndex'],
    highlightedPartIndex ?? -1,
  ];
  const hoveredPartFeature = partFeatures.find(
    (feature) => feature.properties.partIndex === hoveredPartIndex
  );
  const hoveredPartTrack =
    hoveredPartFeature && trackSectionsCache[hoveredPartFeature.properties.track];
  const hoveredPartLocalTrackName =
    hoveredPartIndex !== null
      ? entity.properties.parts[hoveredPartIndex]?.local_track_name
      : undefined;

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
            'circle-radius': ['case', isHighlightedPart, 8, 6],
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
            'circle-radius': ['case', isHighlightedPart, 4, 3],
            'circle-color': colors[mapStyle].op.circleBV,
          }}
        />
      </Source>

      {!isMoving && hoveredPartFeature && hoveredPartTrack?.type === 'success' && (
        <Popup
          className="popup"
          anchor="bottom"
          longitude={hoveredPartFeature.geometry.coordinates[0]}
          latitude={hoveredPartFeature.geometry.coordinates[1]}
          closeButton={false}
        >
          <div>{t('Editor.tools.op-edition.select-part')}</div>
          <EntitySumUp entity={entity} />
          {hoveredPartLocalTrackName && (
            <div>
              {t('Editor.tools.op-edition.part-fields.local_track_name')}:{' '}
              <span className="font-weight-medium">{hoveredPartLocalTrackName}</span>
            </div>
          )}
          <EntitySumUp entity={hoveredPartTrack.track} />
        </Popup>
      )}
      {!isMoving && hoveredTrackId && mousePosition && (
        <Popup
          className="popup"
          anchor="bottom"
          longitude={mousePosition[0]}
          latitude={mousePosition[1]}
          closeButton={false}
        >
          <div>{t('Editor.tools.op-edition.add-part')}</div>
          {hoveredTrackState?.type === 'success' ? (
            <EntitySumUp entity={hoveredTrackState.track} />
          ) : hoveredTrackState?.type === 'error' ? (
            <div className="text-danger">
              {t('Editor.tools.op-edition.track-error', { id: hoveredTrackId })}
            </div>
          ) : (
            <div className="position-relative" style={{ height: 50 }}>
              <LoaderFill className="bg-transparent" />
            </div>
          )}
        </Popup>
      )}
    </>
  );
};

export default OpEditionLayers;
