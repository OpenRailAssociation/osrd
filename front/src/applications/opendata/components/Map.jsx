import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import maplibregl from 'maplibre-gl';
import ReactMapGL, { AttributionControl, ScaleControl } from 'react-map-gl';
import { point as turfPoint } from '@turf/helpers';
import { useSelector } from 'react-redux';
import turfNearestPointOnLine from '@turf/nearest-point-on-line';

/* Main data & layers */
import Background from 'common/Map/Layers/Background';
import VirtualLayers from 'applications/operationalStudies/components/SimulationResults/SimulationResultsMap/VirtualLayers';
import SnappedMarker from 'common/Map/Layers/SnappedMarker';
/* Objects & various */
import TracksGeographic from 'common/Map/Layers/TracksGeographic';
import colors from 'common/Map/Consts/colors';
import osmBlankStyle from 'common/Map/Layers/osmBlankStyle';
import { LAYER_GROUPS_ORDER, LAYERS } from 'config/layerOrder';

import 'common/Map/Map.scss';
import OperationalPoints from 'common/Map/Layers/OperationalPoints';
import Platforms from 'common/Map/Layers/Platforms';
import { getMapMouseEventNearestFeature } from 'utils/mapboxHelper';

export default function Map(props) {
  const { viewport, setViewport, setClickedFeature } = props;
  const mapStyle = useSelector((state) => state.map.mapStyle);
  const [lngLatHover, setLngLatHover] = useState();
  const [trackSectionGeoJSON, setTrackSectionGeoJSON] = useState();
  const [snappedPoint, setSnappedPoint] = useState();
  const mapRef = useRef(null);
  const scaleControlStyle = {
    left: 20,
    bottom: 20,
  };

  const onFeatureClick = (e) => {
    const result = getMapMouseEventNearestFeature(e);
    if (
      result &&
      result.feature.properties &&
      result.feature.properties.id &&
      result.feature.geometry.type === 'LineString'
    ) {
      setClickedFeature(result.feature);
    }
  };

  const onMoveGetFeature = (e) => {
    const result = getMapMouseEventNearestFeature(e);
    if (
      result &&
      result.feature.properties &&
      result.feature.properties.id &&
      result.feature.geometry.type === 'LineString'
    ) {
      setTrackSectionGeoJSON(result.feature.geometry);
      setLngLatHover(result.nearest);
    } else {
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
      mapLib={maplibregl}
      mapStyle={osmBlankStyle}
      onMove={(e) => setViewport(e.viewState)}
      onMouseMove={(e) => onMoveGetFeature(e)}
      attributionControl={false} // Defined below
      onClick={onFeatureClick}
      interactiveLayerIds={['chartis/tracks-geo/main']}
      touchZoomRotate
    >
      <VirtualLayers />
      <AttributionControl className="attribution-control" customAttribution="©SNCF Réseau" />
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
