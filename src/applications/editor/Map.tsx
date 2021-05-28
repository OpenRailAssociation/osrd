import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import ReactMapGL, { AttributionControl, MapEvent, ScaleControl } from 'react-map-gl';

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

interface DeepStruct<T> {
  [key: string]: string | T;
}
type Colors = DeepStruct<Colors>;
const COLORS = colors as Record<string, Colors>;

interface MapProps<S extends CommonToolState = CommonToolState> {
  toolState: S;
  setToolState: (newState: S) => void;
  activeTool: Tool<S>;
}

const Map: FC<MapProps> = ({ toolState, setToolState, activeTool }) => {
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
        clickRadius={4}
        touchRotate
        asyncRender
        doubleClickZoom={false}
        // interactiveLayerIds={INTERACTIVE_LAYER_IDS}
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
                layer: feature.layer.id as string,
                lng: e.lngLat[0],
                lat: e.lngLat[1],
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
        <Background colors={COLORS[mapStyle]} />
        <OSM mapStyle={mapStyle} />
        <Hillshade mapStyle={mapStyle} />
        <Platform colors={COLORS[mapStyle]} />

        {/* Tool specific layers */}
        {activeTool.getLayers && activeTool.getLayers({ mapStyle }, toolState, editorState)}
      </ReactMapGL>
    </>
  );
};

export default Map;
