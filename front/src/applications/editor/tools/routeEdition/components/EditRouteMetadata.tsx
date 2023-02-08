import React, { FC, useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Feature, LineString } from 'geojson';
import { Layer, Popup, Source } from 'react-map-gl';
import { featureCollection, lineString } from '@turf/helpers';
import { useTranslation } from 'react-i18next';
import { cloneDeep, first, isEqual, last } from 'lodash';
import { FaFlagCheckered } from 'react-icons/fa';
import { BsArrowBarRight } from 'react-icons/bs';
import { MdDelete, MdSave } from 'react-icons/md';
import { FiSearch } from 'react-icons/fi';

import { EditRoutePathState, EditRouteMetadataState, RouteEditionState } from '../types';
import { ExtendedEditorContextType, OSRDConf } from '../../types';
import {
  getRoutesLineLayerProps,
  getRoutesPointLayerProps,
  getRoutesTextLayerProps,
} from '../../../../../common/Map/Layers/Routes';
import colors from '../../../../../common/Map/Consts/colors';
import { getEditRouteState, getEmptyCreateRouteState, getRouteGeometryByRouteId } from '../utils';
import EditorContext from '../../../context';
import { getMixedEntities } from '../../../data/api';
import { EditorEntity, WayPointEntity } from '../../../../../types';
import { LoaderFill } from '../../../../../common/Loader';
import { addNotification } from '../../../../../reducers/main';
import ConfirmModal from '../../../components/ConfirmModal';
import { save } from '../../../../../reducers/editor';
import { DisplayEndpoints } from './Endpoints';

export const EditRouteMetadataPanel: FC<{ state: EditRouteMetadataState }> = ({ state }) => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { initialRouteEntity, routeEntity } = state;
  const { entry_point, entry_point_direction, exit_point } = routeEntity.properties;
  const { setState, openModal } = useContext(
    EditorContext
  ) as ExtendedEditorContextType<RouteEditionState>;
  const osrdConf = useSelector(({ osrdconf }: { osrdconf: OSRDConf }) => osrdconf);
  const [isLoading, setIsLoading] = useState(false);

  const isReleaseDetectorsEditionLocked =
    initialRouteEntity.properties.release_detectors.length === 0;

  return (
    <div className="position-relative">
      <legend>{t('Editor.tools.routes-edition.edit-route')}</legend>
      <DisplayEndpoints
        state={{
          entryPointDirection: entry_point_direction,
          // Hack: positions are useless to DisplayEndpoints, but required
          // typewise:
          entryPoint: { ...entry_point, position: [0, 0] },
          exitPoint: { ...exit_point, position: [0, 0] },
        }}
      />

      <hr />

      <div className="form-check mt-4">
        <input
          type="checkbox"
          className="form-check-input"
          id="include-release-detectors"
          checked={!!routeEntity.properties.release_detectors.length}
          disabled={isReleaseDetectorsEditionLocked}
          onChange={(e) => {
            const newRouteEntity = cloneDeep(routeEntity);
            newRouteEntity.properties.release_detectors = e.target.checked
              ? initialRouteEntity.properties.release_detectors
              : [];
            setState({
              ...state,
              routeEntity: newRouteEntity,
            });
          }}
        />
        <label className="form-check-label" htmlFor="include-release-detectors">
          {t('Editor.tools.routes-edition.include-release-detectors')}
        </label>
      </div>
      {!routeEntity.properties.release_detectors.length && (
        <p className="text-info">{t('Editor.tools.routes-edition.locked-release-detectors')}</p>
      )}

      <hr />

      <div className="d-flex flex-column align-items-stretch">
        <button
          className="btn btn-danger btn-sm mt-1"
          type="button"
          onClick={() => {
            openModal({
              component: ConfirmModal,
              arguments: {
                title: t('Editor.tools.routes-edition.delete-route'),
                message: t('Editor.tools.routes-edition.confirm-delete-route'),
              },
              async afterSubmit() {
                setIsLoading(true);
                await dispatch(save({ delete: [initialRouteEntity] as EditorEntity[] }));
                setIsLoading(false);
                addNotification({
                  type: 'success',
                  text: t('Editor.tools.routes-edition.delete-route-success'),
                });
                setState(getEmptyCreateRouteState());
              },
            });
          }}
        >
          <MdDelete /> {t('Editor.tools.routes-edition.delete-route')}
        </button>
        <button
          className="btn btn-primary btn-sm mt-1"
          type="button"
          onClick={() => {
            const baseState = getEmptyCreateRouteState() as EditRoutePathState;

            setIsLoading(true);
            getMixedEntities<WayPointEntity>(osrdConf.infraID as string, [
              entry_point,
              exit_point,
            ]).then((entities) => {
              const entryPointEntity = entities[entry_point.id];
              const exitPointEntity = entities[exit_point.id];
              setIsLoading(false);
              setState({
                ...baseState,
                routeState: {
                  ...baseState.routeState,
                  entryPoint: {
                    id: entry_point.id,
                    type: entry_point.type,
                    position: entryPointEntity.geometry.coordinates,
                  },
                  entryPointDirection: entry_point_direction,
                  exitPoint: {
                    id: exit_point.id,
                    type: exit_point.type,
                    position: exitPointEntity.geometry.coordinates,
                  },
                },
              });
            });
          }}
        >
          <FiSearch /> {t('Editor.tools.routes-edition.alternative-routes')}
        </button>
        <button
          className="btn btn-primary btn-sm mt-1"
          type="button"
          disabled={isEqual(initialRouteEntity.properties, routeEntity.properties)}
          onClick={async () => {
            setIsLoading(true);
            await dispatch(
              save({
                update: [
                  {
                    source: initialRouteEntity,
                    target: routeEntity,
                  },
                ],
              })
            );
            setIsLoading(false);
            addNotification({
              type: 'success',
              text: t('Editor.tools.routes-edition.save-route-success'),
            });
            setState(getEditRouteState(routeEntity));
          }}
        >
          <MdSave /> {t('Editor.tools.routes-edition.save-route')}
        </button>
      </div>

      {isLoading && <LoaderFill />}
    </div>
  );
};

export const EditRouteMetadataLayers: FC<{ state: EditRouteMetadataState }> = ({ state }) => {
  const { t } = useTranslation();
  const osrdConf = useSelector(({ osrdconf }: { osrdconf: OSRDConf }) => osrdconf);
  const { mapStyle } = useSelector((s: { map: { mapStyle: string } }) => s.map) as {
    mapStyle: string;
  };

  const lineProps = useMemo(() => {
    const layer = getRoutesLineLayerProps({ colors: colors[mapStyle] });
    return {
      ...layer,
      paint: {
        ...layer.paint,
        'line-width': 2,
        'line-dasharray': [2, 1],
      },
    };
  }, [mapStyle]);
  const pointProps = useMemo(
    () => getRoutesPointLayerProps({ colors: colors[mapStyle] }),
    [mapStyle]
  );
  const textProps = useMemo(
    () => getRoutesTextLayerProps({ colors: colors[mapStyle] }),
    [mapStyle]
  );

  const [geometryState, setGeometryState] = useState<
    | { type: 'loading'; feature?: undefined }
    | { type: 'error'; feature?: undefined; message?: string }
    | { type: 'ready'; feature?: Feature<LineString, { id: string }> }
  >({ type: 'ready' });
  const firstPoint = useMemo(
    () => (geometryState.feature ? first(geometryState.feature.geometry.coordinates) : null),
    [geometryState.feature]
  );
  const lastPoint = useMemo(
    () => (geometryState.feature ? last(geometryState.feature.geometry.coordinates) : null),
    [geometryState.feature]
  );

  useEffect(() => {
    const { id } = state.initialRouteEntity.properties;

    if (geometryState.type === 'ready' && geometryState.feature?.properties.id !== id) {
      setGeometryState({ type: 'loading' });
      getRouteGeometryByRouteId(osrdConf.infraID as string, id)
        .then((feature) => {
          setGeometryState({
            type: 'ready',
            feature,
          });
        })
        .catch((e) => {
          addNotification({
            type: 'error',
            text: e instanceof Error ? e.message : t('Editor.tools.routes-edition.unknown-error'),
          });

          const { entry_point, exit_point } = state.routeEntity.properties;
          getMixedEntities<WayPointEntity>(osrdConf.infraID as string, [
            entry_point,
            exit_point,
          ]).then((entities) => {
            const entryPointEntity = entities[entry_point.id];
            const exitPointEntity = entities[exit_point.id];
            setGeometryState({
              type: 'ready',
              feature: lineString(
                [entryPointEntity.geometry.coordinates, exitPointEntity.geometry.coordinates],
                { id }
              ),
            });
          });
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.initialRouteEntity.properties.id]);

  return (
    <>
      <Source type="geojson" data={geometryState.feature || featureCollection([])}>
        <Layer {...lineProps} />
        <Layer {...pointProps} />
        <Layer {...textProps} />
      </Source>

      {firstPoint && (
        <Popup
          key="entry-popup"
          className="popup"
          anchor="bottom"
          longitude={firstPoint[0]}
          latitude={firstPoint[1]}
          closeButton={false}
          closeOnClick={false}
        >
          <small>
            <BsArrowBarRight /> {t('Editor.tools.routes-edition.start')}
          </small>
        </Popup>
      )}
      {lastPoint && (
        <Popup
          key="exit-popup"
          className="popup"
          anchor="bottom"
          longitude={lastPoint[0]}
          latitude={lastPoint[1]}
          closeButton={false}
          closeOnClick={false}
        >
          <small>
            <FaFlagCheckered /> {t('Editor.tools.routes-edition.end')}
          </small>
        </Popup>
      )}
    </>
  );
};
