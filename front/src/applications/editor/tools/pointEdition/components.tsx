import mapboxgl from 'mapbox-gl';
import React, { FC, useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Popup } from 'react-map-gl';
import { useTranslation } from 'react-i18next';
import { featureCollection } from '@turf/helpers';
import { merge, isEqual } from 'lodash';
import along from '@turf/along';

import GeoJSONs, { EditorSource, SourcesDefinitionsIndex } from 'common/Map/Layers/GeoJSONs';
import colors from 'common/Map/Consts/colors';
import { save } from 'reducers/editor';
import { NULL_GEOMETRY, CreateEntityOperation, EditorEntity, TrackSectionEntity } from 'types';
import { SIGNALS_TO_SYMBOLS } from 'common/Map/Consts/SignalsNames';
import { PointEditionState } from './types';
import EditorForm from '../../components/EditorForm';
import { cleanSymbolType, flattenEntity, NEW_ENTITY_ID } from '../../data/utils';
import { EditorContextType, ExtendedEditorContextType, OSRDConf } from '../types';
import EditorContext from '../../context';
import EntitySumUp from '../../components/EntitySumUp';
import { getEntity } from '../../data/api';

export const POINT_LAYER_ID = 'pointEditionTool/new-entity';

/**
 * Generic component for point edition left panel:
 */
export const PointEditionLeftPanel: FC = <Entity extends EditorEntity>() => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const osrdConf = useSelector(({ osrdconf }: { osrdconf: OSRDConf }) => osrdconf);
  const { state, setState } = useContext(EditorContext) as ExtendedEditorContextType<
    PointEditionState<Entity>
  >;

  const [trackState, setTrackState] = useState<
    | { type: 'idle'; id?: undefined; track?: undefined }
    | { type: 'isLoading'; id: string; track?: undefined }
    | { type: 'ready'; id: string; track: TrackSectionEntity }
  >({ type: 'idle' });

  useEffect(() => {
    const firstLoading = trackState.type === 'idle';
    const trackId = state.entity.properties.track as string | undefined;

    if (trackId && trackState.id !== trackId) {
      setTrackState({ type: 'isLoading', id: trackId });
      getEntity<TrackSectionEntity>(osrdConf.infraID as string, trackId, 'TrackSection').then(
        (track) => {
          setTrackState({ type: 'ready', id: trackId, track });

          if (!firstLoading) {
            const { position } = state.entity.properties;
            const point = along(track, position, { units: 'meters' });

            setState({ ...state, entity: { ...state.entity, geometry: point.geometry } });
          }
        }
      );
    }
  }, [
    osrdConf.infraID,
    setState,
    state,
    state.entity.properties.track,
    trackState.id,
    trackState.type,
  ]);

  return (
    <EditorForm
      data={state.entity as Entity}
      onSubmit={async (savedEntity) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res: any = await dispatch(
          save(
            state.entity.properties.id !== NEW_ENTITY_ID
              ? {
                  update: [
                    {
                      source: state.initialEntity,
                      target: savedEntity,
                    },
                  ],
                }
              : { create: [savedEntity] }
          )
        );
        const operation = res[0] as CreateEntityOperation;
        const { id } = operation.railjson;
        if (id && id !== savedEntity.properties.id) {
          setState({
            ...state,
            entity: {
              ...state.entity,
              id,
              properties: {
                ...state.entity.properties,
                ...operation.railjson,
              },
            },
          });
        }
      }}
      onChange={(entity) => {
        const additionalUpdate: Partial<Entity> = {};

        const newPosition = entity.properties?.position;
        const oldPosition = state.entity.properties?.position;
        const trackId = entity.properties?.track;
        if (
          typeof trackId === 'string' &&
          trackId === trackState.id &&
          trackState.type === 'ready' &&
          typeof newPosition === 'number' &&
          typeof oldPosition === 'number' &&
          newPosition !== oldPosition
        ) {
          const point = along(trackState.track, newPosition, { units: 'meters' });
          additionalUpdate.geometry = point.geometry;
        }

        setState({ ...state, entity: { ...(entity as Entity), ...additionalUpdate } });
      }}
    >
      <div className="text-right">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!state.entity.properties?.track || !state.entity.geometry}
        >
          {t('common.save')}
        </button>
      </div>
    </EditorForm>
  );
};

export const BasePointEditionLayers: FC<{
  // eslint-disable-next-line react/no-unused-prop-types
  map: mapboxgl.Map;
  mergeEntityWithNearestPoint?: (
    entity: EditorEntity,
    nearestPoint: NonNullable<PointEditionState<EditorEntity>['nearestPoint']>
  ) => EditorEntity;
  interactiveLayerIDRegex?: RegExp;
}> = ({ mergeEntityWithNearestPoint, interactiveLayerIDRegex }) => {
  const {
    state: { nearestPoint, mousePosition, entity, objType },
    editorState: { editorLayers },
  } = useContext(EditorContext) as ExtendedEditorContextType<PointEditionState<EditorEntity>>;
  const { mapStyle } = useSelector((s: { map: { mapStyle: string } }) => s.map) as {
    mapStyle: string;
  };

  const [showPopup, setShowPopup] = useState(true);

  const renderedEntity = useMemo(() => {
    let res: EditorEntity | null = null;
    if (entity.geometry && !isEqual(entity.geometry, NULL_GEOMETRY)) {
      res = entity as EditorEntity;
    } else if (nearestPoint) {
      if (mergeEntityWithNearestPoint) {
        res = mergeEntityWithNearestPoint(entity, nearestPoint);
      } else {
        res = {
          ...entity,
          geometry: nearestPoint.feature.geometry,
          properties: entity.properties,
        };
      }
    } else if (mousePosition) {
      res = { ...entity, geometry: { type: 'Point', coordinates: mousePosition } };
    }

    return res;
  }, [entity, mergeEntityWithNearestPoint, mousePosition, nearestPoint]);

  const flatRenderedEntity = useMemo(
    () => (renderedEntity ? flattenEntity(renderedEntity) : null),
    [renderedEntity]
  );

  const type = cleanSymbolType((entity.properties || {}).extensions?.sncf?.installation_type || '');
  const layers = useMemo(
    () =>
      SourcesDefinitionsIndex[objType](
        {
          prefix: '',
          colors: colors[mapStyle],
          signalsList: [type],
          symbolsList: SIGNALS_TO_SYMBOLS[type] || [],
          sourceLayer: 'geo',
          isEmphasized: true,
          showIGNBDORTHO: false,
        },
        `editor/${objType}/`
      ).map((layer) =>
        // Quick hack to keep a proper interactive layer:
        layer?.id?.match(interactiveLayerIDRegex || /-main$/)
          ? { ...layer, id: POINT_LAYER_ID }
          : layer
      ),
    [interactiveLayerIDRegex, mapStyle, objType, type]
  );

  return (
    <>
      {/* Editor data layer */}
      <GeoJSONs
        colors={colors[mapStyle]}
        hidden={entity.properties.id !== NEW_ENTITY_ID ? [entity.properties.id] : undefined}
        layers={editorLayers}
      />

      {/* Edited entity */}
      <EditorSource layers={layers} data={flatRenderedEntity || featureCollection([])} />
      {showPopup && renderedEntity && renderedEntity.geometry.type === 'Point' && (
        <Popup
          className="popup py-2"
          anchor="bottom"
          longitude={renderedEntity.geometry.coordinates[0]}
          latitude={renderedEntity.geometry.coordinates[1]}
          onClose={() => setShowPopup(false)}
        >
          <EntitySumUp entity={renderedEntity} status="edited" />
        </Popup>
      )}
    </>
  );
};

export const SignalEditionLayers: FC<{ map: mapboxgl.Map }> = ({ map }) => (
  <BasePointEditionLayers
    map={map}
    interactiveLayerIDRegex={/signal-point$/}
    mergeEntityWithNearestPoint={(entity, nearestPoint) => ({
      ...entity,
      geometry: nearestPoint.feature.geometry,
      properties: {
        ...merge(entity.properties, {
          extensions: {
            sncf: {
              angle_geo: nearestPoint.angle,
            },
          },
        }),
      },
    })}
  />
);

export const PointEditionMessages: FC = () => {
  const { t, state } = useContext(EditorContext) as EditorContextType<
    PointEditionState<EditorEntity>
  >;

  if (!state.entity.geometry || isEqual(state.entity.geometry, NULL_GEOMETRY)) {
    return state.nearestPoint
      ? t(`Editor.tools.point-edition.help.stop-dragging-on-line`)
      : t(`Editor.tools.point-edition.help.stop-dragging-no-line`);
  }

  return t(`Editor.tools.point-edition.help.start-dragging`);
};
