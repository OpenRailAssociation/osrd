import React, { FC, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import ReactMapGL, { AttributionControl, ScaleControl } from 'react-map-gl';
import { withTranslation } from 'react-i18next';
import { TFunction } from 'i18next';

import { updateViewport } from 'reducers/map';

import colors from 'common/Map/Consts/colors';
import 'common/Map/Map.scss';

/* Main data & layers */
import Background from 'common/Map/Layers/Background';
import OSM from 'common/Map/Layers/OSM';
import Hillshade from 'common/Map/Layers/Hillshade';
import Platform from 'common/Map/Layers/Platform';
import osmBlankStyle from 'common/Map/Layers/osmBlankStyle';

import { EditorState } from '../../reducers/editor';
import { CommonToolState, Tool } from './tools';

const DEFAULT_RADIUS = 6;

interface MapProps<S extends CommonToolState = CommonToolState> {
  toolState: S;
  setToolState: (newState: S) => void;
  activeTool: Tool<S>;
  t: TFunction;
}

const MapUnplugged: FC<MapProps> = ({ toolState, setToolState, activeTool, t }) => {
  const dispatch = useDispatch();
  const { mapStyle, viewport } = useSelector((state: { map: any }) => state.map);
  const editorState = useSelector((state: { editor: EditorState }) => state.editor);
  const { urlLat, urlLon, urlZoom, urlBearing, urlPitch } = useParams();
  const updateViewportChange = useCallback((value) => dispatch(updateViewport(value, '/editor')), [
    dispatch,
  ]);

  useEffect(() => {
    if (urlLat) {
      updateViewportChange({
        ...viewport,
        latitude: parseFloat(urlLat),
        longitude: parseFloat(urlLon),
        zoom: parseFloat(urlZoom),
        bearing: parseFloat(urlBearing),
        pitch: parseFloat(urlPitch),
      });
    }
  }, []);

  return (
    <>
      <ReactMapGL
        {...viewport}
        width="100%"
        height="100%"
        mapStyle={osmBlankStyle}
        onViewportChange={updateViewportChange}
        attributionControl={false} // Defined below
        clickRadius={
          activeTool.getRadius ? activeTool.getRadius(toolState, editorState) : DEFAULT_RADIUS
        }
        touchRotate
        asyncRender
        doubleClickZoom={false}
        interactiveLayerIds={
          activeTool.getInteractiveLayers
            ? activeTool.getInteractiveLayers(
                { mapStyle, dispatch, setState: setToolState, t },
                toolState,
                editorState
              )
            : []
        }
        getCursor={(mapState: {
          isLoaded: boolean;
          isDragging: boolean;
          isHovering: boolean;
        }): string => {
          if (activeTool.getCursor) {
            return activeTool.getCursor(toolState, editorState, mapState);
          } else {
            return 'default';
          }
        }}
        onClick={(e) => {
          if (toolState.hovered && activeTool.onClickFeature) {
            activeTool.onClickFeature(
              toolState.hovered,
              e,
              { dispatch, setState: setToolState },
              toolState,
              editorState
            );
          }
          if (activeTool.onClickMap) {
            activeTool.onClickMap(e, { dispatch, setState: setToolState }, toolState, editorState);
          }
        }}
        onHover={(e) => {
          const feature = (e.features || [])[0];

          if (feature) {
            setToolState({
              ...toolState,
              hovered: {
                id: feature.properties.OP_id as string,
                properties: feature.properties || {},
                lng: feature.properties.lng,
                lat: feature.properties.lat,
              },
            });
          } else {
            setToolState({ ...toolState, hovered: null });
          }
        }}
        onMouseMove={(e) => {
          setToolState({ ...toolState, mousePosition: e.lngLat });
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
        {activeTool.getLayers &&
          activeTool.getLayers(
            { mapStyle, dispatch, setState: setToolState, t },
            toolState,
            editorState
          )}
      </ReactMapGL>
    </>
  );
};

const Map = withTranslation()(MapUnplugged);

export default Map;
