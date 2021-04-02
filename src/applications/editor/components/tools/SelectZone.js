import React, { useCallback, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useParams } from 'react-router-dom';
import ReactMapGL, { AttributionControl, Layer, ScaleControl, Source } from 'react-map-gl';

import { selectZone } from 'reducers/editor';
import { updateViewport } from 'reducers/map';
import { getGeoJSONRectangle } from 'utils/helpers';
import osmBlankStyle from 'common/Map/Layers/osmBlankStyle';

import colors from 'common/Map/Consts/colors';
import 'common/Map/Map.scss';

/* Main data & layers */
import Background from 'common/Map/Layers/Background';
import OSM from 'common/Map/Layers/OSM';
import Hillshade from 'common/Map/Layers/Hillshade';
import Platform from 'common/Map/Layers/Platform';
import TracksGeographic from 'common/Map/Layers/TracksGeographic';
import EditorZone from 'common/Map/Layers/EditorZone';

const SELECTION_ZONE_STYLE = {
  type: 'line',
  paint: {
    'line-dasharray': [3, 3],
    'line-opacity': 0.8,
  },
};

const SelectZone = () => {
  const { mapStyle, viewport } = useSelector((state) => state.map);
  const { urlLat, urlLon, urlZoom, urlBearing, urlPitch } = useParams();
  const dispatch = useDispatch();
  const updateViewportChange = useCallback((value) => dispatch(updateViewport(value, '/editor')), [
    dispatch,
  ]);

  const [firstCorner, setFirstCorner] = useState(null);
  const [secondCorner, setSecondCorner] = useState(null);

  /* Interactions */
  const getCursor = useCallback((params) => {
    if (params.isDragging) return 'grabbing';
    if (params.isHovering) return 'pointer';
    return 'default';
  }, []);
  const onClick = useCallback(
    (event) => {
      if (!firstCorner) {
        setFirstCorner(event.lngLat);
        setSecondCorner(event.lngLat);
      } else {
        dispatch(selectZone(firstCorner, event.lngLat));
        setFirstCorner(null);
        setSecondCorner(null);
      }
    },
    [firstCorner]
  );
  const onMove = useCallback(
    (event) => {
      if (firstCorner) {
        setSecondCorner(event.lngLat);
      }
    },
    [firstCorner]
  );

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

      {/* Selection rectangle */}
      <EditorZone />
      {firstCorner && secondCorner && (
        <Source type="geojson" data={getGeoJSONRectangle(firstCorner, secondCorner)}>
          <Layer {...SELECTION_ZONE_STYLE} />
        </Source>
      )}
    </ReactMapGL>
  );
};

export default SelectZone;
