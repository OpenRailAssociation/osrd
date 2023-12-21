import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Map } from 'maplibre-gl';
import { Popup } from 'react-map-gl/maplibre';
import { useTranslation } from 'react-i18next';
import { isEqual } from 'lodash';
import along from '@turf/along';
import length from '@turf/length';
import { featureCollection } from '@turf/helpers';
import { BsBoxArrowInRight } from 'react-icons/bs';
import { BiArrowFromLeft, BiArrowToRight } from 'react-icons/bi';

import type {
  ExtendedEditorContextType,
  EditorContextType,
} from 'applications/editor/tools/editorContextTypes';
import EditorContext from 'applications/editor/context';
import TOOL_TYPES from 'applications/editor/tools/toolTypes';
import EditorForm from 'applications/editor/components/EditorForm';
import type { EditoastType } from 'applications/editor/tools/types';
import EntityError from 'applications/editor/components/EntityError';
import EntitySumUp from 'applications/editor/components/EntitySumUp';
import { getEntities, getEntity } from 'applications/editor/data/api';
import { getRouteEditionState } from 'applications/editor/tools/routeEdition/utils';
import type { PointEditionState } from 'applications/editor/tools/pointEdition/types';
import { formatSignalingSystems } from 'applications/editor/tools/pointEdition/utils';
import { CustomPosition } from 'applications/editor/tools/pointEdition/CustomPosition';
import { NEW_ENTITY_ID, flattenEntity, cleanSymbolType } from 'applications/editor/data/utils';
import { CustomFlagSignalCheckbox } from 'applications/editor/tools/pointEdition/CustomFlagSignalCheckbox';
import type {
  EditorEntity,
  TrackSectionEntity,
  RouteEntity,
  SignalEntity,
  DetectorEntity,
  BufferStopEntity,
} from 'types';
import { NULL_GEOMETRY } from 'types';
import { save } from 'reducers/editor';
import { getMap } from 'reducers/map/selectors';
import colors from 'common/Map/Consts/colors';
import GeoJSONs, { EditorSource, SourcesDefinitionsIndex } from 'common/Map/Layers/GeoJSONs';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { Spinner } from 'common/Loaders';
import { useInfraID } from 'common/osrdContext';

export const POINT_LAYER_ID = 'pointEditionTool/new-entity';

type EditorPoint = BufferStopEntity | DetectorEntity | SignalEntity;

interface RoutesListProps {
  type: EditoastType;
  id: string;
}

/**
 * Generic component to show routes starting or ending from the edited waypoint:
 */
export const RoutesList = ({ type, id }: RoutesListProps) => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const infraID = useInfraID();
  const [routesState, setRoutesState] = useState<
    | { type: 'idle' }
    | { type: 'loading' }
    | { type: 'ready'; starting: RouteEntity[]; ending: RouteEntity[] }
    | { type: 'error'; message: string }
  >({ type: 'idle' });
  const { switchTool } = useContext(EditorContext) as ExtendedEditorContextType<unknown>;
  const [getRoutesFromWaypoint] =
    osrdEditoastApi.endpoints.getInfraByInfraIdRoutesAndWaypointTypeWaypointId.useLazyQuery();

  useEffect(() => {
    if (routesState.type === 'idle' && infraID) {
      if (type !== 'BufferStop' && type !== 'Detector') {
        setRoutesState({ type: 'error', message: `${type} elements are not valid waypoints.` });
      } else {
        setRoutesState({ type: 'loading' });
        getRoutesFromWaypoint({ infraId: infraID, waypointType: type, waypointId: id })
          .unwrap()
          .then(({ starting = [], ending = [] }) => {
            if (starting.length || ending.length) {
              getEntities<RouteEntity>(infraID, [...starting, ...ending], 'Route', dispatch)
                .then((entities) => {
                  setRoutesState({
                    type: 'ready',
                    starting: starting.map((routeId) => entities[routeId]),
                    ending: ending.map((routeId) => entities[routeId]),
                  });
                })
                .catch((err) => {
                  setRoutesState({ type: 'error', message: err.message });
                });
            } else {
              setRoutesState({ type: 'ready', starting: [], ending: [] });
            }
          })
          .catch((err) => {
            setRoutesState({ type: 'error', message: err.message });
          });
      }
    }
  }, [routesState]);

  useEffect(() => {
    setRoutesState({ type: 'idle' });
  }, [type, id]);

  if (routesState.type === 'loading' || routesState.type === 'idle')
    return (
      <div className="loader mt-1">
        <Spinner />
      </div>
    );
  if (routesState.type === 'error')
    return (
      <div className="form-error mt-3 mb-3">
        <p>{routesState.message || t('Editor.tools.point-edition.default-routes-error')}</p>
      </div>
    );

  return (
    <>
      {!!routesState.starting.length && (
        <div>
          <h4>
            <BiArrowFromLeft className="me-1" />{' '}
            {t('Editor.tools.point-edition.routes-starting-from')}
          </h4>
          <ul className="list-unstyled">
            {routesState.starting.map((route) => (
              <li key={route.properties.id} className="d-flex align-items-center">
                <div className="flex-shrink-0 mr-3">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    title={t('common.open')}
                    onClick={() => {
                      switchTool({
                        toolType: TOOL_TYPES.ROUTE_EDITION,
                        toolState: getRouteEditionState(route),
                      });
                    }}
                  >
                    <BsBoxArrowInRight />
                  </button>
                </div>
                <div className="flex-grow-1 flex-shrink-1">
                  <EntitySumUp entity={route} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!!routesState.ending.length && (
        <div>
          <h4>
            <BiArrowToRight className="me-1" /> {t('Editor.tools.point-edition.routes-ending-at')}
          </h4>
          <ul className="list-unstyled">
            {routesState.ending.map((route) => (
              <li key={route.properties.id} className="d-flex align-items-center">
                <div className="flex-shrink-0 mr-3">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    title={t('common.open')}
                    onClick={() => {
                      switchTool({
                        toolType: TOOL_TYPES.ROUTE_EDITION,
                        toolState: getRouteEditionState(route),
                      });
                    }}
                  >
                    <BsBoxArrowInRight />
                  </button>
                </div>
                <div className="flex-grow-1 flex-shrink-1">
                  <EntitySumUp entity={route} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!(routesState.starting.length + routesState.ending.length) && (
        <div className="text-center">{t('Editor.tools.point-edition.no-linked-route')}</div>
      )}
    </>
  );
};

interface PointEditionLeftPanelProps {
  type: EditoastType;
}
/**
 * Generic component for point edition left panel:
 */
export const PointEditionLeftPanel = <Entity extends EditorEntity>({
  type,
}: PointEditionLeftPanelProps) => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const infraID = useInfraID();
  const { state, setState, isFormSubmited, setIsFormSubmited } = useContext(
    EditorContext
  ) as ExtendedEditorContextType<PointEditionState<Entity>>;
  const submitBtnRef = useRef<HTMLButtonElement>(null);

  const isWayPoint = type === 'BufferStop' || type === 'Detector';
  const isNew = state.entity.properties.id === NEW_ENTITY_ID;

  const [trackState, setTrackState] = useState<
    | { type: 'idle'; id?: undefined; track?: undefined }
    | { type: 'isLoading'; id: string; track?: undefined }
    | { type: 'ready'; id: string; track: TrackSectionEntity }
  >({ type: 'idle' });

  // Hack to be able to launch the submit event from the rjsf form by using
  // the toolbar button instead of the form one.
  // See https://github.com/rjsf-team/react-jsonschema-form/issues/500
  useEffect(() => {
    if (isFormSubmited && setIsFormSubmited && submitBtnRef.current) {
      submitBtnRef.current.click();
      setIsFormSubmited(false);
    }
  }, [isFormSubmited]);

  useEffect(() => {
    const firstLoading = trackState.type === 'idle';
    const trackId = state.entity.properties.track as string | undefined;

    if (trackId && trackState.id !== trackId) {
      setTrackState({ type: 'isLoading', id: trackId });
      getEntity<TrackSectionEntity>(infraID as number, trackId, 'TrackSection', dispatch).then(
        (track) => {
          setTrackState({ type: 'ready', id: trackId, track });

          if (!firstLoading) {
            const { position } = state.entity.properties;
            const turfPosition =
              (position * length(track, { units: 'meters' })) / track.properties.length;
            const point = along(track, turfPosition, { units: 'meters' });

            setState({ ...state, entity: { ...state.entity, geometry: point.geometry } });
          }
        }
      );
    }
  }, [infraID, setState, state, state.entity.properties.track, trackState.id, trackState.type]);

  return (
    <>
      {isWayPoint && !isNew && (
        <>
          <h3>{t('Editor.tools.point-edition.linked-routes')}</h3>
          <RoutesList type={type} id={state.entity.properties.id} />
          <div className="border-bottom" />
        </>
      )}
      <EditorForm
        data={state.entity as Entity}
        overrideUiSchema={{
          logical_signals: {
            items: {
              signaling_system: {
                'ui:widget': 'hidden',
              },
              settings: {
                'ui:description': ' ',
                Nf: {
                  'ui:description': ' ',
                  'ui:widget': CustomFlagSignalCheckbox,
                },
                distant: {
                  'ui:description': ' ',
                  'ui:widget': CustomFlagSignalCheckbox,
                },
                is_430: {
                  'ui:description': ' ',
                  'ui:widget': CustomFlagSignalCheckbox,
                },
              },
            },
          },
          position: {
            'ui:widget': CustomPosition,
          },
        }}
        onSubmit={async (savedEntity) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const res: any = await dispatch(
            save(
              infraID,
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
          const { railjson } = res[0];
          const { id } = railjson;
          if (id && id !== savedEntity.properties.id) {
            const saveEntity = {
              ...state.entity,
              id,
              properties: {
                ...state.entity.properties,
                ...railjson,
              },
            };
            setState({
              ...state,
              initialEntity: saveEntity,
              entity: saveEntity,
            });
          }
        }}
        onChange={(entity: Entity | EditorPoint) => {
          const additionalUpdate: Partial<EditorPoint> = {};
          const additionalPropertiesUpdate: Partial<SignalEntity['properties']> = {};
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
            const turfPosition =
              (newPosition * length(trackState.track, { units: 'meters' })) /
              trackState.track.properties.length;
            const point = along(trackState.track, turfPosition, { units: 'meters' });
            additionalUpdate.geometry = point.geometry;
          }
          if (entity.objType === 'Signal' && entity.properties.logical_signals) {
            additionalPropertiesUpdate.logical_signals = formatSignalingSystems(
              entity as SignalEntity
            );
          }
          setState({
            ...state,
            entity: {
              ...(entity as Entity),
              ...additionalUpdate,
              properties: { ...(entity as Entity).properties, ...additionalPropertiesUpdate },
            },
          });
        }}
      >
        <div>
          {/* We don't want to see the button but just be able to click on it */}
          <button type="submit" ref={submitBtnRef} style={{ display: 'none' }}>
            {t('common.save')}
          </button>
        </div>
      </EditorForm>

      {!isNew && <EntityError className="mt-1" entity={state.entity} />}
    </>
  );
};

export const getPointEditionLeftPanel =
  (type: EditoastType): ComponentType =>
  () =>
    <PointEditionLeftPanel type={type} />;

interface BasePointEditionLayersProps {
  // eslint-disable-next-line react/no-unused-prop-types
  map: Map;
  mergeEntityWithNearestPoint?: (
    entity: EditorEntity,
    nearestPoint: NonNullable<PointEditionState<EditorEntity>['nearestPoint']>
  ) => EditorEntity;
  interactiveLayerIDRegex?: RegExp;
}

export const BasePointEditionLayers = ({
  mergeEntityWithNearestPoint,
  interactiveLayerIDRegex,
}: BasePointEditionLayersProps) => {
  const infraID = useInfraID();
  const {
    renderingFingerprint,
    state: { nearestPoint, mousePosition, entity, objType },
    editorState: { editorLayers },
  } = useContext(EditorContext) as ExtendedEditorContextType<PointEditionState<EditorEntity>>;
  const { mapStyle, layersSettings, issuesSettings } = useSelector(getMap);

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
          isEmphasized: true,
          showIGNBDORTHO: false,
          layersSettings,
          issuesSettings,
        },
        `editor/${objType}/`
      ).map((layer) =>
        // Quick hack to keep a proper interactive layer:
        layer?.id?.match(interactiveLayerIDRegex || /-main$/)
          ? { ...layer, id: POINT_LAYER_ID }
          : layer
      ),
    [interactiveLayerIDRegex, mapStyle, objType, type, layersSettings, issuesSettings]
  );

  return (
    <>
      {/* Editor data layer */}
      <GeoJSONs
        colors={colors[mapStyle]}
        hidden={entity.properties.id !== NEW_ENTITY_ID ? [entity.properties.id] : undefined}
        layers={editorLayers}
        fingerprint={renderingFingerprint}
        layersSettings={layersSettings}
        issuesSettings={issuesSettings}
        infraID={infraID}
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

export const SignalEditionLayers = ({ map }: { map: Map }) => (
  <BasePointEditionLayers
    map={map}
    interactiveLayerIDRegex={/signal-point$/}
    mergeEntityWithNearestPoint={(entity, nearestPoint) => ({
      ...entity,
      geometry: nearestPoint.feature.geometry,
      properties: entity.properties,
    })}
  />
);

export const PointEditionMessages = () => {
  const { t, state } = useContext(EditorContext) as EditorContextType<
    PointEditionState<EditorEntity>
  >;

  if (!state.entity.geometry || isEqual(state.entity.geometry, NULL_GEOMETRY)) {
    return state.nearestPoint
      ? t(`Editor.tools.point-edition.help.stop-dragging-on-line`).toString()
      : t(`Editor.tools.point-edition.help.stop-dragging-no-line`).toString();
  }

  return t(`Editor.tools.point-edition.help.start-dragging`).toString();
};
