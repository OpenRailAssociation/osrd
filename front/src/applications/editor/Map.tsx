import React, { FC, useContext, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import ReactMapGL, { AttributionControl, ScaleControl, ViewportProps } from 'react-map-gl';
import { withTranslation } from 'react-i18next';
import { TFunction } from 'i18next';

import colors from '../../common/Map/Consts/colors';
import '../../common/Map/Map.scss';

/* Main data & layers */
import Background from '../../common/Map/Layers/Background';
import OSM from '../../common/Map/Layers/OSM';
import Hillshade from '../../common/Map/Layers/Hillshade';
import Platform from '../../common/Map/Layers/Platforms';
import osmBlankStyle from '../../common/Map/Layers/osmBlankStyle';

import { EditorContext } from './context';
import {
  CommonToolState,
  EditorContextType,
  EditorState,
  ExtendedEditorContextType,
  OSRDConf,
  Tool,
} from './tools/types';

const DEFAULT_RADIUS = 6;

interface MapProps<S extends CommonToolState = CommonToolState> {
  t: TFunction;
  toolState: S;
  setToolState: (newState: S) => void;
  activeTool: Tool<S>;
  mapStyle: string;
  viewport: ViewportProps;
  setViewport: (newViewport: ViewportProps) => void;
}

const MapUnplugged: FC<MapProps> = ({
  toolState,
  setToolState,
  activeTool,
  mapStyle,
  viewport,
  setViewport,
}) => {
  const dispatch = useDispatch();
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

  return (
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
        width="100%"
        height="100%"
        mapStyle={osmBlankStyle}
        onViewportChange={(newViewport: ViewportProps) => setViewport(newViewport)}
        attributionControl={false} // Defined below
        clickRadius={activeTool.getRadius ? activeTool.getRadius(extendedContext) : DEFAULT_RADIUS}
        touchRotate
        asyncRender
        doubleClickZoom={false}
        interactiveLayerIds={
          activeTool.getInteractiveLayers ? activeTool.getInteractiveLayers(extendedContext) : []
        }
        getCursor={(mapState: {
          isLoaded: boolean;
          isDragging: boolean;
          isHovering: boolean;
        }): string =>
          activeTool.getCursor ? activeTool.getCursor(extendedContext, mapState) : 'default'
        }
        onClick={(e) => {
          if (toolState.hovered && activeTool.onClickFeature) {
            activeTool.onClickFeature(toolState.hovered, e, extendedContext);
          }
          if (activeTool.onClickMap) {
            activeTool.onClickMap(e, extendedContext);
          }
        }}
        onHover={(e) => {
          const feature = (e.features || [])[0];
          const entity = feature?.properties?.id
            ? editorState.entitiesIndex[feature.properties.id]
            : undefined;

          if (activeTool.onHover) {
            activeTool.onHover(e, extendedContext);
          } else if (entity) {
            setToolState({
              ...toolState,
              hovered: entity,
            });
          } else {
            setToolState({ ...toolState, hovered: null });
          }
        }}
        onMouseMove={(e) => {
          setToolState({ ...toolState, mousePosition: e.lngLat });
          if (activeTool.onMove) {
            activeTool.onMove(e, extendedContext);
          }
        }}
        onMouseLeave={() => {
          setToolState({ ...toolState, mousePosition: null });
        }}
      >
        <AttributionControl
          className="attribution-control"
          customAttribution="©SNCF/DGEX Solutions"
        />
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
        <OSM mapStyle={mapStyle} />
        <Hillshade mapStyle={mapStyle} />
        <Platform colors={colors[mapStyle]} />

        {/* Tool specific layers */}
        {activeTool.layersComponent && <activeTool.layersComponent />}
      </ReactMapGL>
    </div>
  );
};

const Map = withTranslation()(MapUnplugged);

export default Map;
