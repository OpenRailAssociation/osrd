import React, { FC, PropsWithChildren, useContext, useMemo, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import ReactMapGL, { AttributionControl, MapRef, ScaleControl } from 'react-map-gl/maplibre';
import { withTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import { isEmpty, isEqual } from 'lodash';

import VirtualLayers from 'modules/simulationResult/components/SimulationResultsMap/VirtualLayers';
import colors from 'common/Map/Consts/colors';
import 'common/Map/Map.scss';

/* Main data & layers */
import IGN_SCAN25 from 'common/Map/Layers/IGN_SCAN25';
import IGN_CADASTRE from 'common/Map/Layers/IGN_CADASTRE';
import { LAYER_GROUPS_ORDER, LAYERS } from 'config/layerOrder';
import TracksOSM from 'common/Map/Layers/TracksOSM';
import { CUSTOM_ATTRIBUTION } from 'common/Map/const';
import Terrain from 'common/Map/Layers/Terrain';
import Background from '../../common/Map/Layers/Background';
import OSM from '../../common/Map/Layers/OSM';
import Hillshade from '../../common/Map/Layers/Hillshade';
import Platforms from '../../common/Map/Layers/Platforms';
import { useMapBlankStyle } from '../../common/Map/Layers/blankStyle';
import IGN_BD_ORTHO from '../../common/Map/Layers/IGN_BD_ORTHO';
import { Viewport } from '../../reducers/map';
import { getMapMouseEventNearestFeature } from '../../utils/mapHelper';
import EditorContext from './context';
import { EditorState, LAYER_TO_EDITOAST_DICT, LAYERS_SET, LayerType } from './tools/types';
import { getEntity } from './data/api';
import { getInfraID } from '../../reducers/osrdconf/selectors';
import { getShowOSM, getTerrain3DExaggeration } from '../../reducers/map/selectors';
import { CommonToolState } from './tools/commonToolState';
import { EditorContextType, ExtendedEditorContextType, Tool } from './tools/editorContextTypes';
import { useSwitchTypes } from './tools/switchEdition/types';

interface MapProps<S extends CommonToolState = CommonToolState> {
  t: TFunction;
  toolState: S;
  setToolState: (state: Partial<S>) => void;
  activeTool: Tool<S>;
  mapStyle: string;
  viewport: Viewport;
  setViewport: (newViewport: Partial<Viewport>, updateRouter?: boolean) => void;
}

interface MapState {
  isLoaded: boolean;
  isDragging: boolean;
  isHovering: boolean;
}

const MapUnplugged: FC<PropsWithChildren<MapProps>> = ({
  toolState,
  setToolState,
  activeTool,
  mapStyle,
  viewport,
  setViewport,
  children,
}) => {
  const dispatch = useDispatch();
  const mapBlankStyle = useMapBlankStyle();
  const mapRef = useRef<MapRef>(null);
  const [mapState, setMapState] = useState<MapState>({
    isLoaded: true,
    isDragging: false,
    isHovering: false,
  });
  const context = useContext(EditorContext) as EditorContextType<CommonToolState>;
  const infraID = useSelector(getInfraID);
  const switchTypes = useSwitchTypes(infraID);
  const editorState = useSelector((state: { editor: EditorState }) => state.editor);
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

  const cursor = useMemo(
    () => (activeTool.getCursor ? activeTool.getCursor(extendedContext, mapState) : 'default'),
    [activeTool, extendedContext, mapState]
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
          onMoveStart={() => setMapState((prev) => ({ ...prev, isDragging: true }))}
          onMoveEnd={() => {
            setMapState((prev) => ({ ...prev, isDragging: false }));
          }}
          onMouseOut={() => {
            setToolState({ hovered: null });
          }}
          onMouseMove={(e) => {
            const nearestResult = getMapMouseEventNearestFeature(e);
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
                  id: feature.properties?.id as string,
                  type: LAYER_TO_EDITOAST_DICT[feature.sourceLayer as LayerType],
                  renderedEntity: feature,
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
          terrain={{ source: 'terrain', exaggeration: terrain3DExaggeration }}
          doubleClickZoom={false}
          interactive
          cursor={cursor}
          interactiveLayerIds={interactiveLayerIDs}
          onClick={(e) => {
            const nearestResult = getMapMouseEventNearestFeature(e);
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
                getEntity(
                  infraID as number,
                  toolState.hovered.id,
                  toolState.hovered.type,
                  dispatch
                ).then((entity) => {
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
                });
              }
            }
            if (activeTool.onClickMap) {
              activeTool.onClickMap(eventWithFeature, extendedContext);
            }
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

          <IGN_BD_ORTHO layerOrder={LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]} />
          <IGN_SCAN25 layerOrder={LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]} />
          <IGN_CADASTRE layerOrder={LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]} />

          {!showOSM ? null : (
            <>
              <OSM mapStyle={mapStyle} layerOrder={LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]} />
              <Hillshade
                mapStyle={mapStyle}
                layerOrder={LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]}
                display={terrain3DExaggeration > 0}
              />
            </>
          )}
          <Platforms
            colors={colors[mapStyle]}
            layerOrder={LAYER_GROUPS_ORDER[LAYERS.PLATFORMS.GROUP]}
          />

          {/* Tool specific layers */}
          {activeTool.layersComponent && mapRef.current && (
            <activeTool.layersComponent map={mapRef.current.getMap()} />
          )}
        </ReactMapGL>
      </div>
      ;{children}
    </>
  );
};

const Map = withTranslation()(MapUnplugged);

export default Map;
