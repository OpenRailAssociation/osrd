import React, { FC, PropsWithChildren, useContext, useMemo, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import maplibregl from 'maplibre-gl';
import ReactMapGL, { AttributionControl, ScaleControl } from 'react-map-gl';
import { withTranslation } from 'react-i18next';
import { TFunction } from 'i18next';

import VirtualLayers from 'applications/osrd/views/OSRDSimulation/VirtualLayers';
import colors from 'common/Map/Consts/colors';
import 'common/Map/Map.scss';

/* Main data & layers */
import { LAYER_GROUPS_ORDER, LAYERS } from 'config/layerOrder';
import Background from '../../common/Map/Layers/Background';
import OSM from '../../common/Map/Layers/OSM';
import Hillshade from '../../common/Map/Layers/Hillshade';
import Platforms from '../../common/Map/Layers/Platforms';
import osmBlankStyle from '../../common/Map/Layers/osmBlankStyle';
import OrthoPhoto from '../../common/Map/Layers/OrthoPhoto';
import { Viewport } from '../../reducers/map';
import { EditorContext } from './context';
import {
  CommonToolState,
  EditorContextType,
  EditorState,
  ExtendedEditorContextType,
  OSRDConf,
  Tool,
} from './tools/types';
import VirtualLayers from '../osrd/views/OSRDSimulation/VirtualLayers';

const DEFAULT_RADIUS = 6;

interface MapProps<S extends CommonToolState = CommonToolState> {
  t: TFunction;
  toolState: S;
  setToolState: (newState: S) => void;
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
  const [mapState, setMapState] = useState<MapState>({
    isLoaded: true,
    isDragging: false,
    isHovering: false,
  });
  const context = useContext(EditorContext) as EditorContextType<CommonToolState>;
  const osrdConf = useSelector((state: { osrdconf: OSRDConf }) => state.osrdconf);
  const editorState = useSelector((state: { editor: EditorState }) => state.editor);
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
          mapLib={maplibregl}
          style={{ width: '100%', height: '100%' }}
          mapStyle={osmBlankStyle}
          onMove={(e) => setViewport(e.viewState)}
          onMoveStart={() => setMapState((prev) => ({ ...prev, isDragging: true }))}
          onMoveEnd={() => setMapState((prev) => ({ ...prev, isDragging: false }))}
          onMouseEnter={(e) => {
            setMapState((prev) => ({ ...prev, isHovering: true }));
            const feature = (e.features || [])[0];
            if (activeTool.onHover) {
              activeTool.onHover(e, extendedContext);
            } else if (feature && feature.properties) {
              const entity = feature?.properties?.id
                ? editorState.entitiesIndex[feature.properties.id]
                : undefined;
              setToolState({
                ...toolState,
                hovered: entity || null,
              });
            } else {
              setToolState({ ...toolState, hovered: null });
            }
          }}
          onMouseLeave={() => {
            setMapState((prev) => ({ ...prev, isHovering: false }));
            setToolState({ ...toolState, mousePosition: null, hovered: null });
          }}
          onLoad={(e) => {
            // need to call resize, otherwise sometime the canvas doesn't take 100%
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
          interactiveLayerIds={
            activeTool.getInteractiveLayers ? activeTool.getInteractiveLayers(extendedContext) : []
          }
          cursor={cursor}
          onClick={(e) => {
            if (toolState.hovered && activeTool.onClickFeature) {
              activeTool.onClickFeature(toolState.hovered, e, extendedContext);
            }
            if (activeTool.onClickMap) {
              activeTool.onClickMap(e, extendedContext);
            }
          }}
          onMouseMove={(e) => {
            setToolState({ ...toolState, mousePosition: [e.lngLat.lng, e.lngLat.lat] });
            if (activeTool.onMove) {
              activeTool.onMove(e, extendedContext);
            }
          }}
        >
          <AttributionControl position="bottom-right" customAttribution="©SNCF/DGEX Solutions" />
          <ScaleControl
            maxWidth={100}
            unit="metric"
            style={{
              left: 20,
              bottom: 20,
            }}
          />

          {/* Common layers */}
          <Background colors={colors[mapStyle]} />
          <OrthoPhoto layerOrder={LAYER_GROUPS_ORDER[LAYERS.PLATFORMS.GROUP]} />
          <OSM mapStyle={mapStyle} />
          <Hillshade mapStyle={mapStyle} />
          <VirtualLayers />
          <Platforms colors={colors[mapStyle]} />

          {/* Tool specific layers */}
          {activeTool.layersComponent && <activeTool.layersComponent />}
        </ReactMapGL>
      </div>
      {children}
    </>
  );
};

const Map = withTranslation()(MapUnplugged);

export default Map;
