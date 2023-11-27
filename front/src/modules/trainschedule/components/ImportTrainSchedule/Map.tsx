import React, { useEffect, useRef, useState } from 'react';
import ReactMapGL, {
  AttributionControl,
  ScaleControl,
  MapLayerMouseEvent,
} from 'react-map-gl/maplibre';
import { point as turfPoint } from '@turf/helpers';
import { useSelector } from 'react-redux';
import turfNearestPointOnLine, { NearestPointOnLine } from '@turf/nearest-point-on-line';

/* Main data & layers */
import Background from 'common/Map/Layers/Background';
import VirtualLayers from 'modules/simulationResult/components/SimulationResultsMap/VirtualLayers';
import SnappedMarker from 'common/Map/Layers/SnappedMarker';
/* Objects & various */
import TracksGeographic from 'common/Map/Layers/TracksGeographic';
import colors from 'common/Map/Consts/colors';
import { useMapBlankStyle } from 'common/Map/Layers/blankStyle';
import { LAYER_GROUPS_ORDER, LAYERS } from 'config/layerOrder';

import 'common/Map/Map.scss';
import OperationalPoints from 'common/Map/Layers/OperationalPoints';
import { Platforms } from 'common/Map/Layers/Platforms';
import { getMapMouseEventNearestFeature } from 'utils/mapHelper';
import { CUSTOM_ATTRIBUTION } from 'common/Map/const';
import { getMapStyle } from 'reducers/map/selectors';
import { LineString } from 'geojson';

interface MapProps {
  viewport: { latitude: number; longitude: number };
  setViewport: (viewPort: { latitude: number; longitude: number }) => void;
  setClickedFeatureId: (clickedFeatureId: string) => void;
}

const viewportExtraSettings = {
  altitude: 1.5,
  bearing: 0,
  maxZoom: 24,
  minZoom: 0,
  pitch: 0,
  maxPitch: 60,
  minPitch: 0,
  transitionDuration: 100,
  zoom: 18,
};

const Map = ({ viewport, setViewport, setClickedFeatureId }: MapProps) => {
  const mapBlankStyle = useMapBlankStyle();
  const mapStyle = useSelector(getMapStyle);

  const [lngLatHover, setLngLatHover] = useState<number[] | undefined>();
  const [trackSectionGeoJSON, setTrackSectionGeoJSON] = useState<LineString | undefined>();
  const [snappedPoint, setSnappedPoint] = useState<NearestPointOnLine | undefined>();
  const mapRef = useRef(null);
  const scaleControlStyle = {
    left: 20,
    bottom: 20,
  };

  const onFeatureClick = (e: MapLayerMouseEvent) => {
    const result = getMapMouseEventNearestFeature(e);
    if (
      result &&
      result.feature.properties &&
      result.feature.properties.id &&
      result.feature.geometry.type === 'LineString'
    ) {
      setClickedFeatureId(result.feature.properties.id);
    }
  };

  const onMoveGetFeature = (e: MapLayerMouseEvent) => {
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
      {...viewportExtraSettings}
      {...viewport}
      style={{ cursor: 'pointer', width: '100%', height: '100%' }}
      mapStyle={mapBlankStyle}
      onMove={(e) => setViewport(e.viewState)}
      onMouseMove={(e) => onMoveGetFeature(e)}
      attributionControl={false} // Defined below
      onClick={onFeatureClick}
      interactiveLayerIds={['chartis/tracks-geo/main']}
      touchZoomRotate
    >
      <VirtualLayers />
      <AttributionControl position="bottom-right" customAttribution={CUSTOM_ATTRIBUTION} />
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
        colors={colors[mapStyle]}
        layerOrder={LAYER_GROUPS_ORDER[LAYERS.OPERATIONAL_POINTS.GROUP]}
      />
      {snappedPoint !== undefined ? <SnappedMarker geojson={snappedPoint} /> : null}
    </ReactMapGL>
  );
};

export default Map;
