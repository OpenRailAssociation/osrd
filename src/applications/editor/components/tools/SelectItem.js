import React, { useCallback, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useParams } from 'react-router-dom';
import ReactMapGL, { AttributionControl, ScaleControl } from 'react-map-gl';

import { updateViewport } from 'reducers/map';
import osmBlankStyle from 'common/Map/Layers/osmBlankStyle';

import colors from 'common/Map/Consts/colors';
import 'common/Map/Map.scss';

/* Main data & layers */
import Background from 'common/Map/Layers/Background';
import OSM from 'common/Map/Layers/OSM';
import Hillshade from 'common/Map/Layers/Hillshade';
import Platform from 'common/Map/Layers/Platform';
import TracksGeographic from 'common/Map/Layers/TracksGeographic';

/* Objects & various */
import EditorZone from '../../../../common/Map/Layers/EditorZone';

const INTERACTIVE_LAYER_IDS = ['chartis/tracks-geo/main', 'chartis/tracks-geo/service'];

const SelectItem = () => {
  const { mapStyle, viewport } = useSelector((state) => state.map);
  const [hoveredItem, setHoveredItem] = useState(null);
  const editorState = useSelector((state) => state.editor);
  const { urlLat, urlLon, urlZoom, urlBearing, urlPitch } = useParams();
  const dispatch = useDispatch();
  const updateViewportChange = useCallback((value) => dispatch(updateViewport(value, '/editor')), [
    dispatch,
  ]);

  /* Interactions */
  const getCursor = useCallback((params) => {
    if (params.isDragging) return 'grabbing';
    if (params.isHovering) return 'pointer';
    return 'default';
  }, []);
  const onFeatureClick = useCallback(
    (event) => {
      console.log('SELECT::CLICK', event);
    },
    [editorState]
  );
  const onFeatureHover = useCallback(
    (event) => {
      if (event.features.length) {
        setHoveredItem({
          layer: event.features[0].layer.id,
          id: event.features[0].properties.OP_id,
        });
      } else {
        setHoveredItem(null);
      }
    },
    [editorState]
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
      interactiveLayerIds={INTERACTIVE_LAYER_IDS}
      clickRadius={4}
      attributionControl={false} // Defined below
      onClick={onFeatureClick}
      onHover={onFeatureHover}
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
      <TracksGeographic
        colors={colors[mapStyle]}
        idHover={
          hoveredItem && hoveredItem.layer.match(/^chartis\/tracks-geo/)
            ? hoveredItem.id
            : undefined
        }
      />

      {/* Editor layers */}
      <EditorZone />
    </ReactMapGL>
  );
};

export default SelectItem;
