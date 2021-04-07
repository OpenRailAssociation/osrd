import React, { useCallback, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useParams } from 'react-router-dom';
import ReactMapGL, { AttributionControl, Layer, ScaleControl, Source } from 'react-map-gl';
import { isEqual } from 'lodash';

import { createLine } from 'reducers/editor';
import { updateViewport } from 'reducers/map';
import { getGeoJSONPolyline } from 'utils/helpers';
import { KeyDownMapController } from 'utils/mapboxHelper';
import osmBlankStyle from 'common/Map/Layers/osmBlankStyle';

import colors from 'common/Map/Consts/colors';
import 'common/Map/Map.scss';

/* Main data & layers */
import Background from 'common/Map/Layers/Background';
import OSM from 'common/Map/Layers/OSM';
import Hillshade from 'common/Map/Layers/Hillshade';
import Platform from 'common/Map/Layers/Platform';
import TracksGeographic from 'common/Map/Layers/TracksGeographic';
import CustomLines from 'common/Map/Layers/CustomLines';
import EditorZone from 'common/Map/Layers/EditorZone';

const NEW_LINE_STYLE = {
  type: 'line',
  paint: {
    'line-color': '#000000',
  },
};

const LAST_LINE_STYLE = {
  type: 'line',
  paint: {
    'line-color': '#000000',
    'line-dasharray': [3, 3],
  },
};

const CreateLine = () => {
  const { mapStyle, viewport } = useSelector((state) => state.map);
  const { urlLat, urlLon, urlZoom, urlBearing, urlPitch } = useParams();
  const dispatch = useDispatch();
  const updateViewportChange = useCallback((value) => dispatch(updateViewport(value, '/editor')), [
    dispatch,
  ]);

  const [state, setState] = useState({ points: [], mousePoint: null });
  const { points, mousePoint } = state;

  /* Interactions */
  const getCursor = (params) => (params.isDragging ? 'grabbing' : 'crosshair');
  const onClick = useCallback(
    (event) => {
      const point = event.lngLat;
      if (isEqual(point, points[points.length - 1]) && points.length > 1) {
        dispatch(createLine(points));
        setState({ ...state, points: [] });
      } else {
        setState({ ...state, points: points.concat([point]), mousePoint: point });
      }
    },
    [state]
  );
  const onMove = (event) => {
    setState({ ...state, mousePoint: event.lngLat });
  };
  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      setState({ ...state, points: [] });
    } else if (event.key === 'Backspace' && points.length) {
      setState({ ...state, points: points.slice(0, -1) });
    } else if (event.key === 'Enter' && points.length > 1) {
      dispatch(createLine(points));
      setState({ ...state, points: [] });
    }
  };

  /* Custom controller for keyboard handling */
  const [mapController] = useState(new KeyDownMapController(onKeyDown));

  useEffect(() => {
    mapController.setHandler(onKeyDown);
  }, [onKeyDown]);

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
    <ReactMapGL
      {...viewport}
      width="100%"
      height="100%"
      getCursor={getCursor}
      mapStyle={osmBlankStyle}
      onViewportChange={updateViewportChange}
      attributionControl={false}
      onClick={onClick}
      onMouseMove={onMove}
      controller={mapController}
      doubleClickZoom={false}
      touchRotate
      asyncRender
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

      {/* OSM layers */}
      <Background colors={colors[mapStyle]} />
      <OSM mapStyle={mapStyle} />
      <Hillshade mapStyle={mapStyle} />
      <Platform colors={colors[mapStyle]} />

      {/* Chartis layers */}
      <TracksGeographic colors={colors[mapStyle]} />

      {/* Editor layers */}
      <EditorZone />
      <CustomLines />

      {points.length > 1 ? (
        <Source type="geojson" data={getGeoJSONPolyline(points)}>
          <Layer {...NEW_LINE_STYLE} />
        </Source>
      ) : null}
      {points.length && (
        <Source type="geojson" data={getGeoJSONPolyline([points[points.length - 1], mousePoint])}>
          <Layer {...LAST_LINE_STYLE} />
        </Source>
      )}
    </ReactMapGL>
  );
};

export default CreateLine;
