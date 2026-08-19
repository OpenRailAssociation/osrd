import { useContext, useMemo, useState, type PropsWithChildren } from 'react';

import type { Geometry } from 'geojson';
import type { TFunction } from 'i18next';
import { isEmpty, isNil } from 'lodash';
import { withTranslation } from 'react-i18next';
import ReactMapGL, { AttributionControl, ScaleControl, type MapRef } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import getInfraErrorFromTileProperties from 'applications/editor/components/InfraErrors/utils';
import type { Layer } from 'applications/editor/consts';
import { LAYER_TO_EDITOAST_DICT, LAYERS_SET } from 'applications/editor/consts';
import EditorContext from 'applications/editor/context';
import { getEntity } from 'applications/editor/data/api';
import useSwitchTypes from 'applications/editor/tools/switchEdition/useSwitchTypes';
import type { CommonToolState } from 'applications/editor/tools/types';
import type { EditorContextType, ExtendedEditorContextType, Tool } from 'applications/editor/types';
import { CUSTOM_ATTRIBUTION } from 'common/Map/const';
import {
  IGNLayers,
  LineSearchLayer,
  NeutralSectionsLayer,
  OperationalPointsLayer,
  OSMLayers,
  Platforms,
  SearchMarker,
  useMapBlankStyle,
  VirtualLayers,
} from 'common/Map/Layers';
import LevelCrossingsLayer from 'common/Map/Layers/InfraObjectLayers/LevelCrossing';
import { colors } from 'common/Map/theme';
import { LAYER_GROUPS_ORDER, LAYERS } from 'config/layerOrder';
import { useMapSettingsActions } from 'reducers/commonMap';
import type { MapStyle, Viewport } from 'reducers/commonMap/types';
import { getEditorState } from 'reducers/editor/selectors';
import { useAppDispatch } from 'store';
import { getMapMouseEventNearestFeature } from 'utils/mapHelper';

type MapProps<S extends CommonToolState = CommonToolState> = {
  t: TFunction;
  toolState: S;
  setToolState: (state: Partial<S>) => void;
  activeTool: Tool<S>;
  mapStyle: MapStyle;
  viewport: Viewport;
  setViewport: (newViewport: Partial<Viewport>, updateRouter?: boolean) => void;
  mapRef: React.RefObject<MapRef | null>;
  infraID: number | undefined;
};

const MapUnplugged = ({
  mapRef,
  toolState,
  setToolState,
  activeTool,
  mapStyle,
  viewport,
  setViewport,
  children,
  infraID,
}: PropsWithChildren<MapProps>) => {
  const dispatch = useAppDispatch();
  const { removeMapSearchMarker } = useMapSettingsActions();
  const mapBlankStyle = useMapBlankStyle();
  const [isDraggingState, setIsDraggingState] = useState<boolean>(false);
  const context = useContext(EditorContext) as EditorContextType<CommonToolState>;
  const { data: switchTypes } = useSwitchTypes(infraID);
  const editorState = useSelector(getEditorState);

  const {
    mapSettings: {
      showOSM,
      showOSM3dBuildings,
      showOSMtracksections,
      terrain3DExaggeration,
      mapSearchMarker,
      lineSearchCode,
    },
  } = editorState;

  const extendedContext = useMemo<ExtendedEditorContextType<CommonToolState>>(
    () => ({
      ...context,
      dispatch,
      editorState,
      infraID,
      switchTypes,
      mapState: {
        viewport,
        mapStyle,
      },
    }),
    [context, dispatch, editorState, mapStyle, infraID, switchTypes, viewport]
  );
  const interactiveLayerIDs = useMemo(
    () => (activeTool.getInteractiveLayers ? activeTool.getInteractiveLayers(extendedContext) : []),
    [activeTool, extendedContext]
  );
  const eventsLayerIDs = useMemo(
    () => (activeTool.getEventsLayers ? activeTool.getEventsLayers(extendedContext) : null),
    [activeTool, extendedContext]
  );

  const cursor = useMemo(
    () =>
      activeTool.getCursor ? activeTool.getCursor(extendedContext, isDraggingState) : 'default',
    [activeTool, extendedContext, isDraggingState]
  );

  return (
    <>
      <div
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        role="none"
        className="w-100 h-100"
        onKeyDown={(e) => {
          if (activeTool.onKeyDown) activeTool.onKeyDown(e.nativeEvent, extendedContext);
        }}
      >
        <ReactMapGL
          {...viewport}
          ref={mapRef}
          style={{ width: '100%', height: '100%' }}
          mapStyle={mapBlankStyle}
          onMove={(e) => setViewport(e.viewState)}
          onDragStart={() => setIsDraggingState(true)}
          onDragEnd={() => setIsDraggingState(false)}
          onMouseOut={() => {
            setToolState({ hovered: null });
          }}
          onMouseMove={(e) => {
            const nearestResult = getMapMouseEventNearestFeature(
              e,
              eventsLayerIDs
                ? {
                    layersId: eventsLayerIDs,
                  }
                : undefined
            );

            const partialToolState: Partial<CommonToolState> = {
              mousePosition: [e.lngLat.lng, e.lngLat.lat],
            };

            // if we hover something
            if (nearestResult) {
              const { feature } = nearestResult;
              if (activeTool.onHover) {
                activeTool.onHover(
                  {
                    ...e,
                    // (don't remove those 2 lines or TypeScript won't be happy)
                    preventDefault: e.preventDefault,
                    defaultPrevented: e.defaultPrevented,
                    // Ensure there is a feature, and the good one:
                    features: [feature],
                  },
                  extendedContext
                );
              } else if (
                feature.sourceLayer &&
                LAYERS_SET.has(feature.sourceLayer) &&
                feature.properties &&
                feature.properties.id &&
                feature.properties.id !== toolState.hovered?.id
              ) {
                partialToolState.hovered = {
                  id: feature.properties.id,
                  type: LAYER_TO_EDITOAST_DICT[feature.sourceLayer as Layer],
                  renderedEntity: feature,
                };
              } else if (feature.sourceLayer === 'errors') {
                partialToolState.hovered = {
                  id: feature.properties.obj_id,
                  type: feature.properties?.obj_type,
                  renderedEntity: feature,
                  error: getInfraErrorFromTileProperties(feature.properties),
                };
              }
            } else {
              partialToolState.hovered = null;
            }

            if (activeTool.onMove) {
              activeTool.onMove(
                nearestResult
                  ? {
                      ...e,
                      // (don't remove those 2 lines or TypeScript won't be happy)
                      preventDefault: e.preventDefault,
                      defaultPrevented: e.defaultPrevented,
                      // Ensure there is a feature, and the good one:
                      features: [nearestResult.feature],
                    }
                  : e,
                extendedContext
              );
            }

            if (!isEmpty(partialToolState)) setToolState(partialToolState);
          }}
          onLoad={(e) => {
            // need to call resize, otherwise sometimes the canvas doesn't take 100%
            e.target.resize();
          }}
          onResize={(e) => {
            setViewport({
              width: e.target.getContainer().offsetWidth,
              height: e.target.getContainer().offsetHeight,
            });
          }}
          attributionControl={false}
          touchZoomRotate
          maxPitch={85}
          terrain={
            terrain3DExaggeration
              ? { source: 'terrain', exaggeration: terrain3DExaggeration }
              : undefined
          }
          doubleClickZoom={false}
          interactive
          cursor={cursor}
          interactiveLayerIds={interactiveLayerIDs}
          onClick={(e) => {
            const nearestResult = getMapMouseEventNearestFeature(
              e,
              eventsLayerIDs
                ? {
                    layersId: eventsLayerIDs,
                  }
                : undefined
            );

            const eventWithFeature = nearestResult
              ? {
                  ...e,
                  // (don't remove those 2 lines or TypeScript won't be happy)
                  preventDefault: e.preventDefault,
                  defaultPrevented: e.defaultPrevented,
                  features: [nearestResult.feature],
                }
              : e;
            if (toolState.hovered && activeTool.onClickEntity) {
              if (toolState.hovered.type) {
                getEntity(infraID!, toolState.hovered.id, toolState.hovered.type, dispatch).then(
                  (entity) => {
                    if (activeTool.onClickEntity) {
                      // Those features lack a proper "geometry", and have a "_geometry"
                      // instead. This fixes it:
                      entity = {
                        ...entity,
                        geometry: entity.geometry || (entity as { _geometry?: Geometry })._geometry,
                      };
                      activeTool.onClickEntity(entity, eventWithFeature, extendedContext);
                    }
                  }
                );
              }
            }
            if (activeTool.onClickMap) {
              activeTool.onClickMap(eventWithFeature, extendedContext);
            }
            dispatch(removeMapSearchMarker());
          }}
        >
          <VirtualLayers />
          <AttributionControl position="bottom-right" customAttribution={CUSTOM_ATTRIBUTION} />
          <ScaleControl
            maxWidth={100}
            unit="metric"
            style={{
              left: 20,
              bottom: 20,
            }}
          />

          <OSMLayers
            mapStyle={mapStyle}
            showOSM={showOSM}
            showOSM3dBuildings={showOSM3dBuildings}
            showOSMtracksections={showOSMtracksections}
            hidePlatforms
          />
          <IGNLayers />

          <LineSearchLayer
            layerOrder={LAYER_GROUPS_ORDER[LAYERS.LINE_SEARCH.GROUP]}
            infraID={infraID}
            lineSearchCode={lineSearchCode}
          />

          {editorState.mapSettings.layersSettings.platforms && (
            <Platforms
              colors={colors[mapStyle]}
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.PLATFORMS.GROUP]}
            />
          )}

          {editorState.mapSettings.layersSettings.neutral_sections && (
            <NeutralSectionsLayer
              colors={colors[mapStyle]}
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.NEUTRAL_SECTIONS.GROUP]}
            />
          )}

          {editorState.mapSettings.layersSettings.operational_points && (
            <OperationalPointsLayer
              colors={colors[mapStyle]}
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.OPERATIONAL_POINTS.GROUP]}
            />
          )}

          {editorState.mapSettings.layersSettings.level_crossings && (
            <LevelCrossingsLayer
              colors={colors[mapStyle]}
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.LEVEL_CROSSINGS.GROUP]}
            />
          )}

          {/* Tool specific layers */}
          {!isNil(infraID) && activeTool.layersComponent && mapRef.current && (
            <activeTool.layersComponent map={mapRef.current.getMap()} />
          )}
          {mapSearchMarker && <SearchMarker data={mapSearchMarker} colors={colors[mapStyle]} />}
        </ReactMapGL>
      </div>
      {children}
    </>
  );
};

const Map = withTranslation()(MapUnplugged);

export default Map;
