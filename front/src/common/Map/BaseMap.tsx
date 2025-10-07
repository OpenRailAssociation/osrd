import { type MutableRefObject, type PropsWithChildren, useEffect, useState } from 'react';

import type { Geometry } from 'geojson';
import type { MapLayerMouseEvent, MapLibreEvent } from 'maplibre-gl';
import ReactMapGL, { AttributionControl, ScaleControl } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import { useParams } from 'react-router-dom';

import {
  IGNLayers,
  InfraObjectLayers,
  LineSearchLayer,
  OSMLayers,
  SearchMarker,
  VirtualLayers,
  useMapBlankStyle,
} from 'common/Map/Layers';
import { colors } from 'common/Map/theme';
import { LAYER_GROUPS_ORDER, LAYERS } from 'config/layerOrder';
import type { MapSettings, Viewport } from 'reducers/commonMap/types';

import { CUSTOM_ATTRIBUTION } from './const';

type MapProps = {
  mapSettings: MapSettings;
  mapId: string;
  mapRef: MutableRefObject<MapRef | null>;
  interactiveLayerIds: string[];
  infraId?: number;
  updatePartialViewPort: (
    newPartialViewPort: Partial<Viewport>,
    options?: { updateRouter: boolean }
  ) => void;
  cursor?: 'default' | 'pointer' | 'normal';
  hideAttribution?: boolean;
  hoveredOperationalPointId?: string;
  onClick?: (e: MapLayerMouseEvent) => void;
  onMouseEnter?: (e: MapLayerMouseEvent) => void;
  onMouseMove?: (e: MapLayerMouseEvent) => void;
  onIdle?: (e: MapLibreEvent) => void;
  /**
   * If an area is provided, then the map style is focus on it :
   * - filtering all data layouts on this area
   * - OP & tracks are full displayed, but elements ouside the area are muted
   */
  highlightedArea?: Geometry;
  highlightedOperationalPoints?: number[];
};

const BaseMap = ({
  mapId,
  mapRef,
  children,
  interactiveLayerIds,
  infraId,
  mapSettings,
  cursor = 'default',
  hideAttribution = false,
  hoveredOperationalPointId,
  updatePartialViewPort,
  onClick,
  onMouseEnter,
  onMouseMove,
  onIdle,
  highlightedArea,
  highlightedOperationalPoints,
}: PropsWithChildren<MapProps>) => {
  const mapBlankStyle = useMapBlankStyle();

  const [mapIsLoaded, setMapIsLoaded] = useState(false);

  const { urlLat = '', urlLon = '', urlZoom = '', urlBearing = '', urlPitch = '' } = useParams();

  const {
    viewport,
    mapStyle,
    layersSettings,
    showOSM,
    showOSM3dBuildings,
    showOSMtracksections,
    terrain3DExaggeration,
    mapSearchMarker,
    lineSearchCode,
    showIGNBDORTHO,
    showIGNSCAN25,
    showIGNCadastre,
  } = mapSettings;
  useEffect(() => {
    if (urlLat) {
      updatePartialViewPort({
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
      id={mapId}
      ref={mapRef}
      {...viewport}
      interactiveLayerIds={interactiveLayerIds}
      canvasContextAttributes={{ preserveDrawingBuffer: true }}
      cursor={cursor}
      mapStyle={mapBlankStyle}
      terrain={
        terrain3DExaggeration
          ? { source: 'terrain', exaggeration: terrain3DExaggeration }
          : undefined
      }
      onMouseEnter={onMouseEnter}
      onMouseMove={onMouseMove}
      onClick={onClick}
      onIdle={onIdle}
      // default behavior
      onMove={(e) => {
        updatePartialViewPort(e.viewState);
      }}
      onMoveEnd={(e) => updatePartialViewPort(e.viewState, { updateRouter: true })}
      onResize={(e) => {
        updatePartialViewPort({
          width: e.target.getContainer().offsetWidth,
          height: e.target.getContainer().offsetHeight,
        });
      }}
      onLoad={() => {
        setMapIsLoaded(true);
      }}
      attributionControl={false} // Defined below
      dragPan
      maxPitch={85}
      scrollZoom
      style={{ width: '100%', height: '100%' }}
      touchZoomRotate
    >
      <VirtualLayers />
      {!hideAttribution && (
        <AttributionControl position="bottom-right" customAttribution={CUSTOM_ATTRIBUTION} />
      )}
      <ScaleControl
        maxWidth={100}
        unit="metric"
        style={{
          left: 20,
          bottom: 20,
        }}
      />

      {infraId && (
        <InfraObjectLayers
          infraId={infraId}
          mapStyle={mapStyle}
          hoveredOperationalPointId={hoveredOperationalPointId}
          layersSettings={layersSettings}
          highlightedArea={highlightedArea}
          highlightedOperationalPoints={highlightedOperationalPoints}
        />
      )}

      <OSMLayers
        hidePlatforms={!layersSettings.platforms}
        mapStyle={mapStyle}
        showOSM={showOSM && mapIsLoaded}
        showOSM3dBuildings={showOSM3dBuildings && mapIsLoaded}
        showOSMtracksections={showOSMtracksections && mapIsLoaded}
      />
      <IGNLayers
        showIGNBDORTHO={showIGNBDORTHO}
        showIGNCadastre={showIGNCadastre}
        showIGNSCAN25={showIGNSCAN25}
      />

      <LineSearchLayer
        layerOrder={LAYER_GROUPS_ORDER[LAYERS.LINE_SEARCH.GROUP]}
        infraID={infraId}
        lineSearchCode={lineSearchCode}
      />

      {mapSearchMarker && <SearchMarker data={mapSearchMarker} colors={colors[mapStyle]} />}

      {children}
    </ReactMapGL>
  );
};

export default BaseMap;
