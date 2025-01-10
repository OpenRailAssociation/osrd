import { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { featureCollection } from '@turf/helpers';
import type { Feature, LineString } from 'geojson';
import { compact, isNil } from 'lodash';
import { useTranslation } from 'react-i18next';
import { BsArrowBarRight } from 'react-icons/bs';
import { FaFlagCheckered } from 'react-icons/fa';
import { Layer, Popup, Source, type LineLayer } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import EntitySumUp from 'applications/editor/components/EntitySumUp';
import EditorContext from 'applications/editor/context';
import { nestEntity } from 'applications/editor/data/utils';
import type {
  RouteEditionState,
  WayPointEntity,
} from 'applications/editor/tools/routeEdition/types';
import {
  getOptionsStateType,
  getRouteGeometryByRouteId,
} from 'applications/editor/tools/routeEdition/utils';
import type { ExtendedEditorContextType } from 'applications/editor/types';
import type { EditorEntity } from 'applications/editor/typesEditorEntity';
import colors from 'common/Map/Consts/colors';
import GeoJSONs from 'common/Map/Layers/InfraObjectLayers/GeoJSONs';
import {
  getRoutesLineLayerProps,
  getRoutesPointLayerProps,
  getRoutesTextLayerProps,
} from 'common/Map/Layers/InfraObjectLayers/Routes';
import { useInfraID } from 'common/osrdContext';
import { getMap } from 'reducers/map/selectors';
import { useAppDispatch } from 'store';
import { NULL_GEOMETRY, type OmitLayer, type NullGeometry } from 'types';

const RouteEditionLayers = () => {
  const {
    state,
    renderingFingerprint,
    editorState: { editorLayers },
  } = useContext(EditorContext) as ExtendedEditorContextType<RouteEditionState>;

  const { mapStyle, layersSettings, issuesSettings } = useSelector(getMap);
  const infraID = useInfraID();

  const selectedRouteIndex =
    state.optionsState.type === 'options' ? state.optionsState.focusedOptionIndex : undefined;

  const selectedRouteDetectors =
    selectedRouteIndex !== undefined
      ? state.optionsState.options![selectedRouteIndex].data.detectors
      : [];

  const selectedRouteSwitches =
    selectedRouteIndex !== undefined
      ? Object.keys(state.optionsState.options![selectedRouteIndex].data.switches_directions)
      : [];

  const selectionList = compact([
    state.entity?.properties.entry_point.id,
    state.entity?.properties.exit_point?.id,
  ]).concat(selectedRouteDetectors, selectedRouteSwitches);

  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [entityGeo, setEntityGeo] = useState<null | Feature<LineString> | Feature<NullGeometry>>(
    null
  );

  const shouldDisplayOptions = useMemo(
    () => state.optionsState.type === 'options',
    [state.optionsState.type]
  );

  /**
   * Map style for lines.
   */
  const lineProps = useMemo(() => {
    const layer = getRoutesLineLayerProps({ colors: colors[mapStyle] });
    return {
      ...layer,
      paint: {
        ...layer.paint,
        'line-color': ['get', 'color'],
        'line-width': 2,
        'line-dasharray': [2, 1],
        'line-offset': ['get', 'offset'],
      },
    } as OmitLayer<LineLayer>;
  }, [mapStyle]);

  /**
   * Map style for points
   */
  const pointProps = useMemo(
    () => getRoutesPointLayerProps({ colors: colors[mapStyle] }),
    [mapStyle]
  );

  /**
   * Map style for  line text
   */
  const textProps = useMemo(
    () => getRoutesTextLayerProps({ colors: colors[mapStyle] }),
    [mapStyle]
  );

  /**
   * Compute hovered entity.
   */
  const hoveredWayPoint = useMemo(
    () =>
      state.hovered?.type === 'BufferStop' || state.hovered?.type === 'Detector'
        ? (nestEntity(
            state.hovered.renderedEntity as EditorEntity,
            state.hovered.type
          ) as WayPointEntity)
        : null,
    [state.hovered?.renderedEntity, state.hovered?.type]
  );

  /**
   * Compute feature collection of route options.
   */
  const geoOptionsFeature = useMemo(() => {
    const options = getOptionsStateType(state.optionsState);
    return featureCollection(
      options
        .map((opt) => ({
          ...opt.feature,
          properties: {
            ...opt.feature.properties,
            offset: opt.feature.properties.index * 2 + 3,
          },
        }))
        .reverse()
    );
  }, [state.optionsState]);

  const getRouteGeometry = useCallback(
    async (id: string) => {
      if (!infraID) throw new Error('No infra selected');
      return getRouteGeometryByRouteId(infraID, id, dispatch);
    },
    [infraID, dispatch]
  );

  const entryPointLocation = useMemo(() => {
    const geo = state.extremitiesEntity.BEGIN?.geometry;
    if (geo && geo.type === 'Point') return geo.coordinates;
    return undefined;
  }, [state.extremitiesEntity.BEGIN]);

  const exitPointLocation = useMemo(() => {
    const geo = state.extremitiesEntity.END?.geometry;
    if (geo && geo.type === 'Point') return geo.coordinates;
    return undefined;
  }, [state.extremitiesEntity.END]);

  /**
   * When initial entity changed
   * => load its geometry
   */
  useEffect(() => {
    // if there is an initial entity
    if (!isNil(state.initialEntity)) {
      getRouteGeometry(state.initialEntity.properties.id).then((d) => {
        setEntityGeo({
          ...d,
          properties: {
            ...d.properties,
            color: colors[mapStyle].routes.text,
          },
        });
      });
    }
    return () => {
      setEntityGeo({ type: 'Feature', properties: {}, geometry: NULL_GEOMETRY });
    };
  }, [state.initialEntity, state.entity, mapStyle]);

  return (
    <>
      {/* Editor data layer */}
      <GeoJSONs
        selection={selectionList.length > 1 ? selectionList : undefined}
        colors={colors[mapStyle]}
        layers={editorLayers}
        fingerprint={renderingFingerprint}
        layersSettings={layersSettings}
        issuesSettings={issuesSettings}
        infraID={infraID}
      />

      {/* Displaying options */}
      {shouldDisplayOptions && (
        <Source type="geojson" data={geoOptionsFeature}>
          <Layer {...lineProps} />
          <Layer {...pointProps} />
          <Layer {...textProps} />
        </Source>
      )}

      {!shouldDisplayOptions && (
        <Source type="geojson" data={entityGeo}>
          <Layer {...lineProps} />
          <Layer {...pointProps} />
          <Layer {...textProps} />
        </Source>
      )}

      {entryPointLocation && (
        <Popup
          key="entry-popup"
          className="popup"
          anchor="bottom"
          longitude={entryPointLocation[0]}
          latitude={entryPointLocation[1]}
          closeButton={false}
          closeOnClick={false}
        >
          <small>
            <BsArrowBarRight /> {t('Editor.tools.routes-edition.start')}
          </small>
        </Popup>
      )}
      {exitPointLocation && (
        <Popup
          key="exit-popup"
          className="popup"
          anchor="bottom"
          longitude={exitPointLocation[0]}
          latitude={exitPointLocation[1]}
          closeButton={false}
          closeOnClick={false}
        >
          <small>
            <FaFlagCheckered /> {t('Editor.tools.routes-edition.end')}
          </small>
        </Popup>
      )}

      {/* Hovered waypoint */}
      {state.extremityState.type === 'selection' && hoveredWayPoint && state.mousePosition && (
        <Popup
          key="hover-popup"
          className="popup"
          anchor="bottom"
          longitude={state.mousePosition[0]}
          latitude={state.mousePosition[1]}
          closeButton={false}
          closeOnClick={false}
        >
          <EntitySumUp objType={hoveredWayPoint.objType} id={hoveredWayPoint.properties.id} />
        </Popup>
      )}
    </>
  );
};

export default RouteEditionLayers;
