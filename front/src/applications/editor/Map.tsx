import React, { FC, PropsWithChildren, useContext, useMemo, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import ReactMapGL, { AttributionControl, ScaleControl } from 'react-map-gl';
import { withTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import maplibregl from 'maplibre-gl';
import { isEmpty, isEqual } from 'lodash';
import mapboxgl from 'mapbox-gl';

import VirtualLayers from 'applications/osrd/views/OSRDSimulation/VirtualLayers';
import colors from 'common/Map/Consts/colors';
import 'common/Map/Map.scss';

/* Main data & layers */
import IGN_SCAN25 from 'common/Map/Layers/IGN_SCAN25';
import IGN_CADASTRE from 'common/Map/Layers/IGN_CADASTRE';
import { LAYER_GROUPS_ORDER, LAYERS } from 'config/layerOrder';
import TracksOSM from 'common/Map/Layers/TracksOSM';
import { RootState } from 'reducers';
import Background from '../../common/Map/Layers/Background';
import OSM from '../../common/Map/Layers/OSM';
import Hillshade from '../../common/Map/Layers/Hillshade';
import Platforms from '../../common/Map/Layers/Platforms';
import osmBlankStyle from '../../common/Map/Layers/osmBlankStyle';
import IGN_BD_ORTHO from '../../common/Map/Layers/IGN_BD_ORTHO';
import { Viewport } from '../../reducers/map';
import { getMapMouseEventNearestFeature } from '../../utils/mapboxHelper';
import EditorContext from './context';
import {
  CommonToolState,
  EditorContextType,
  EditorState,
  ExtendedEditorContextType,
  LAYER_TO_EDITOAST_DICT,
  LAYERS_SET,
  LayerType,
  OSRDConf,
  Tool,
} from './tools/types';
import { getEntity } from './data/api';

interface MapProps<S extends CommonToolState = CommonToolState> {
  t: TFunction;
  toolState: S;
  setToolState: (state: Partial<S>) => void;
  activeTool: Tool<S>;
  mapStyle: string;
  viewport: Viewport;
  setViewport: (newViewport: Partial<Viewport>) => void;
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
  const map = useRef(null);
  const [mapState, setMapState] = useState<MapState>({
    isLoaded: true,
    isDragging: false,
    isHovering: false,
  });
  const context = useContext(EditorContext) as EditorContextType<CommonToolState>;
  const osrdConf = useSelector((state: { osrdconf: OSRDConf }) => state.osrdconf);
  const editorState = useSelector((state: { editor: EditorState }) => state.editor);
  const { showOSM } = useSelector((state: RootState) => state.map);
  const extendedContext = useMemo<ExtendedEditorContextType<CommonToolState>>(
    () => ({
      ...context,
      dispatch,
      editorState,
      osrdConf,
      mapState: {
        viewport,
        mapStyle,
      },
    }),
    [context, dispatch, editorState, mapStyle, osrdConf, viewport]
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
          ref={map}
          key={activeTool.id}
          mapLib={maplibregl}
          style={{ width: '100%', height: '100%' }}
          mapStyle={osmBlankStyle}
          onMove={(e) => setViewport(e.viewState)}
          onMoveStart={() => setMapState((prev) => ({ ...prev, isDragging: true }))}
          onMoveEnd={() => setMapState((prev) => ({ ...prev, isDragging: false }))}
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
                    // (don't remove this or TypeScript won't be happy)
                    preventDefault: e.preventDefault,
                    // Ensure there is a feature, and the good one:
                    features: [feature],
                  },
                  extendedContext
                );
              } else if (
                feature &&
                LAYERS_SET.has(feature.sourceLayer) &&
                feature.properties &&
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

            if (activeTool.onMove && (!nearestResult || !activeTool.onHover)) {
              activeTool.onMove(e, extendedContext);
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
          doubleClickZoom={false}
          interactive
          cursor={cursor}
          interactiveLayerIds={interactiveLayerIDs}
          onClick={(e) => {
            const nearestResult = getMapMouseEventNearestFeature(e);
            const eventWithFeature = nearestResult
              ? {
                  ...e,
                  preventDefault: e.preventDefault,
                  features: [nearestResult.feature],
                }
              : e;
            if (toolState.hovered && activeTool.onClickEntity) {
              getEntity(
                osrdConf.infraID as string,
                toolState.hovered.id,
                toolState.hovered.type
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
            if (activeTool.onClickMap) {
              activeTool.onClickMap(eventWithFeature, extendedContext);
            }
          }}
        >
          <VirtualLayers />
          <AttributionControl position="bottom-right" customAttribution="©SNCF Réseau" />
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
              />
            </>
          )}
          <Platforms
            colors={colors[mapStyle]}
            layerOrder={LAYER_GROUPS_ORDER[LAYERS.PLATFORMS.GROUP]}
          />

          {/* Tool specific layers */}
          {activeTool.layersComponent && map.current && (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <activeTool.layersComponent map={(map.current as any).getMap() as mapboxgl.Map} />
          )}
        </ReactMapGL>
      </div>
      {children}
    </>
  );
};

const Map = withTranslation()(MapUnplugged);

export default Map;
