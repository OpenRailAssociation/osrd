import { useContext, useMemo, useState, type PropsWithChildren } from 'react';

import type { TFunction } from 'i18next';
import { isEmpty, isEqual, isNil } from 'lodash';
import { withTranslation } from 'react-i18next';
import ReactMapGL, { AttributionControl, ScaleControl, type MapRef } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import { LAYER_TO_EDITOAST_DICT, LAYERS_SET } from 'applications/editor/consts';
import type { Layer } from 'applications/editor/consts';
import EditorContext from 'applications/editor/context';
import { getEntity } from 'applications/editor/data/api';
import useSwitchTypes from 'applications/editor/tools/switchEdition/useSwitchTypes';
import type { CommonToolState } from 'applications/editor/tools/types';
import type { EditorContextType, ExtendedEditorContextType, Tool } from 'applications/editor/types';
import type { InfraError } from 'common/api/osrdEditoastApi';
import { CUSTOM_ATTRIBUTION } from 'common/Map/const';
import colors from 'common/Map/Consts/colors';
import Background from 'common/Map/Layers/Background';
import { useMapBlankStyle } from 'common/Map/Layers/blankStyle';
import Hillshade from 'common/Map/Layers/Hillshade';
import IGNLayers from 'common/Map/Layers/IGNLayers';
import { NeutralSectionsLayer, OperationalPointsLayer } from 'common/Map/Layers/InfraObjectLayers';
import LineSearchLayer from 'common/Map/Layers/LineSearchLayer';
import OSM from 'common/Map/Layers/OSM';
import { Platforms as PlatformsLayer } from 'common/Map/Layers/Platforms';
import SearchMarker from 'common/Map/Layers/SearchMarker';
import Terrain from 'common/Map/Layers/Terrain';
import TracksOSM from 'common/Map/Layers/TracksOSM';
import { removeSearchItemMarkersOnMap } from 'common/Map/utils';
import { LAYER_GROUPS_ORDER, LAYERS } from 'config/layerOrder';
import VirtualLayers from 'modules/simulationResult/components/SimulationResultsMap/VirtualLayers';
import { getEditorState } from 'reducers/editor/selectors';
import type { Viewport } from 'reducers/map';
import { getMap, getShowOSM, getTerrain3DExaggeration } from 'reducers/map/selectors';
import { useAppDispatch } from 'store';
import { getMapMouseEventNearestFeature } from 'utils/mapHelper';

interface MapProps<S extends CommonToolState = CommonToolState> {
  t: TFunction;
  toolState: S;
  setToolState: (state: Partial<S>) => void;
  activeTool: Tool<S>;
  mapStyle: string;
  viewport: Viewport;
  setViewport: (newViewport: Partial<Viewport>, updateRouter?: boolean) => void;
  mapRef: React.RefObject<MapRef>;
  infraID: number | undefined;
}

interface MapState {
  isLoaded: boolean;
  isDragging: boolean;
  isHovering: boolean;
}

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
  const mapBlankStyle = useMapBlankStyle();
  const [mapState, setMapState] = useState<MapState>({
    isLoaded: true,
    isDragging: false,
    isHovering: false,
  });
  const context = useContext(EditorContext) as EditorContextType<CommonToolState>;
  const { data: switchTypes } = useSwitchTypes(infraID);
  const editorState = useSelector(getEditorState);
  const showOSM = useSelector(getShowOSM);
  const terrain3DExaggeration = useSelector(getTerrain3DExaggeration);

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
    () => (activeTool.getCursor ? activeTool.getCursor(extendedContext, mapState) : 'default'),
    [activeTool, extendedContext, mapState]
  );

  const { mapSearchMarker } = useSelector(getMap);

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
          onMoveStart={() => setMapState((prev) => ({ ...prev, isDragging: true }))}
          onMoveEnd={() => {
            setMapState((prev) => ({ ...prev, isDragging: false }));
          }}
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
            const partialMapState: Partial<MapState> = { isHovering: false };

            // if we hover something
            if (nearestResult) {
              const { feature } = nearestResult;
              partialMapState.isHovering = true;
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
                  error: feature.properties as InfraError,
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

            const newMapState = { ...mapState, ...partialMapState };
            if (!isEqual(mapState, newMapState)) setMapState(newMapState);
          }}
          onLoad={(e) => {
            // need to call resize, otherwise sometimes the canvas doesn't take 100%
            e.target.resize();
            setMapState((prev) => ({ ...prev, isLoaded: false }));
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
                        // eslint-disable-next-line no-underscore-dangle,@typescript-eslint/no-explicit-any
                        geometry: entity.geometry || (entity as any)._geometry,
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
            removeSearchItemMarkersOnMap(dispatch);
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

          {/* Common layers */}
          <Background
            colors={colors[mapStyle]}
            layerOrder={LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]}
          />
          <Terrain />
          <TracksOSM
            colors={colors[mapStyle]}
            layerOrder={LAYER_GROUPS_ORDER[LAYERS.TRACKS_OSM.GROUP]}
          />

          <IGNLayers />

          {!showOSM ? null : (
            <>
              <OSM mapStyle={mapStyle} layerOrder={LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]} />
              <Hillshade
                mapStyle={mapStyle}
                layerOrder={LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]}
              />
            </>
          )}

          <LineSearchLayer
            layerOrder={LAYER_GROUPS_ORDER[LAYERS.LINE_SEARCH.GROUP]}
            infraID={infraID}
          />

          {editorState.editorLayers.has('platforms') && (
            <PlatformsLayer
              colors={colors[mapStyle]}
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.PLATFORMS.GROUP]}
            />
          )}

          {editorState.editorLayers.has('neutral_sections') && (
            <NeutralSectionsLayer
              colors={colors[mapStyle]}
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.DEAD_SECTIONS.GROUP]}
              infraID={infraID}
              overrideStore
            />
          )}

          {editorState.editorLayers.has('operational_points') && (
            <OperationalPointsLayer
              colors={colors[mapStyle]}
              layerOrder={LAYER_GROUPS_ORDER[LAYERS.OPERATIONAL_POINTS.GROUP]}
              infraID={infraID}
              overrideStore
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
