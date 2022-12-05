import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import ReactMapGL, { AttributionControl, ScaleControl } from 'react-map-gl';
import { point as turfPoint, featureCollection } from '@turf/helpers';
import { useSelector } from 'react-redux';
import turfNearestPointOnLine from '@turf/nearest-point-on-line';
import combine from '@turf/combine';

/* Main data & layers */
import Background from 'common/Map/Layers/Background';
import VirtualLayers from 'applications/osrd/views/OSRDSimulation/VirtualLayers';
import SnappedMarker from 'common/Map/Layers/SnappedMarker';
/* Objects & various */
import TracksGeographic from 'common/Map/Layers/TracksGeographic';
import colors from 'common/Map/Consts/colors';
import osmBlankStyle from 'common/Map/Layers/osmBlankStyle';
import { LAYER_GROUPS_ORDER, LAYERS } from 'config/layerOrder';

import 'common/Map/Map.scss';
import OperationalPoints from 'common/Map/Layers/OperationalPoints';
import Platforms from 'common/Map/Layers/Platforms';

export default function Map(props) {
  const { viewport, setViewport, setClickedFeature } = props;
  const { mapStyle } = useSelector((state) => state.map);
  const [idHover, setIdHover] = useState();
  const [lngLatHover, setLngLatHover] = useState();
  const [trackSectionGeoJSON, setTrackSectionGeoJSON] = useState();
  const [snappedPoint, setSnappedPoint] = useState();
  const mapRef = useRef(null);
  const scaleControlStyle = {
    left: 20,
    bottom: 20,
  };

  const onFeatureClick = (e) => {
    if (e.features && e.features.length > 0 && e.features[0].properties.id !== undefined) {
      setClickedFeature(e.features[0]);
    }
  };

  const getGeoJSONFeature = (e) => {
    if (e.features && e.features[0] !== undefined) {
      const mergedFeatures = combine(featureCollection(e.features));
      setTrackSectionGeoJSON(mergedFeatures.features[0].geometry);
    }
  };

  const onFeatureHover = (e) => {
    if (e.features !== null && e?.features?.[0] !== undefined) {
      getGeoJSONFeature(e);
      setIdHover(e.features[0].properties.id);
      setLngLatHover(e?.lngLat);
    } else {
      setIdHover(undefined);
      setSnappedPoint(undefined);
    }
  };

  useEffect(() => {
    if (trackSectionGeoJSON !== undefined && lngLatHover !== undefined) {
      const point = turfPoint(lngLatHover);
      try {
        setSnappedPoint(turfNearestPointOnLine(trackSectionGeoJSON, point));
      } catch (error) {
        console.warn(`Ìmpossible to snapPoint - error ${error}`);
      }
    }
  }, [trackSectionGeoJSON, lngLatHover]);

  return (
    <ReactMapGL
      ref={mapRef}
      {...viewport}
      style={{ cursor: 'pointer' }}
      width="100%"
      height="100%"
      mapStyle={osmBlankStyle}
      onViewportChange={setViewport}
      clickRadius={10}
      attributionControl={false} // Defined below
      onClick={onFeatureClick}
      onHover={onFeatureHover}
      interactiveLayerIds={['chartis/tracks-geo/main']}
      touchRotate
      asyncRender
    >
      <VirtualLayers />
      <AttributionControl
        className="attribution-control"
        customAttribution="©SNCF/DGEX Solutions"
      />
      <ScaleControl maxWidth={100} unit="metric" style={scaleControlStyle} />

      <Background
        colors={colors[mapStyle]}
        layerOrder={LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]}
      />

      <Platforms
        colors={colors[mapStyle]}
        layerOrder={LAYER_GROUPS_ORDER[LAYERS.PLATFORMS.GROUP]}
      />

      <TracksGeographic
        colors={colors[mapStyle]}
        layerOrder={LAYER_GROUPS_ORDER[LAYERS.TRACKS_GEOGRAPHIC.GROUP]}
      />
      <OperationalPoints
        geomType="geo"
        colors={colors[mapStyle]}
        layerOrder={LAYER_GROUPS_ORDER[LAYERS.OPERATIONAL_POINTS.GROUP]}
      />
      {snappedPoint !== undefined ? <SnappedMarker geojson={snappedPoint} /> : null}
    </ReactMapGL>
  );
}

Map.propTypes = {
  viewport: PropTypes.object.isRequired,
  setViewport: PropTypes.func.isRequired,
  setClickedFeature: PropTypes.func.isRequired,
};
