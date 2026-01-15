import { type PropsWithChildren, type RefObject, useEffect, useState } from 'react';

import type { Geometry } from 'geojson';
import type { MapLayerMouseEvent, MapLibreEvent } from 'maplibre-gl';
import { useTranslation } from 'react-i18next';
import type { MapRef } from 'react-map-gl/maplibre';
import ReactMapGL, { AttributionControl, ScaleControl } from 'react-map-gl/maplibre';
import { useParams } from 'react-router-dom';

import {
  IGNLayers,
  InfraObjectLayers,
  LineSearchLayer,
  OSMLayers,
  SearchMarker,
  useMapBlankStyle,
  VirtualLayers,
} from 'common/Map/Layers';
import { colors } from 'common/Map/theme';
import { LAYER_GROUPS_ORDER, LAYERS } from 'config/layerOrder';
import type { MapSettings, Viewport } from 'reducers/commonMap/types';

import { CUSTOM_ATTRIBUTION } from './const';

type MapProps = {
  mapSettings: MapSettings;
  mapId: string;
  mapRef: RefObject<MapRef | null>;
  interactiveLayerIds: string[];
  infraId?: number;
  updatePartialViewPort: (newPartialViewPort: Partial<Viewport>) => void;
  cursor?: 'default' | 'pointer' | 'normal';
  hideAttribution?: boolean;
  hoveredOperationalPointId?: string;
  onClick?: (e: MapLayerMouseEvent) => void;
  onMouseEnter?: (e: MapLayerMouseEvent) => void;
  onMouseMove?: (e: MapLayerMouseEvent) => void;
  onIdle?: (e: MapLibreEvent) => void;
  onIdleRouterSync?: (e: MapLibreEvent) => void;
  /**
   * If an area is provided, then the map style is focus on it :
   * - filtering all data layouts on this area
   * - OP & tracks are full displayed, but elements ouside the area are muted
   */
  highlightedArea?: Geometry;
  cooperativeGestures?: boolean;
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
  onIdleRouterSync,
  highlightedArea,
  cooperativeGestures = false,
}: PropsWithChildren<MapProps>) => {
  const { t } = useTranslation();
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
  } = mapSettings;

  const cooperativeGesturesLocale = {
    'CooperativeGesturesHandler.WindowsHelpText': t('map.cooperativeGestures.ctrl'),
    'CooperativeGesturesHandler.MacHelpText': t('map.cooperativeGestures.cmd'),
  };

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
      onIdle={(e) => {
        onIdle?.(e);
        onIdleRouterSync?.(e);
      }}
      // default behavior
      onMove={(e) => {
        updatePartialViewPort(e.viewState);
      }}
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
      cooperativeGestures={cooperativeGestures}
      locale={cooperativeGesturesLocale}
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
          mapStyle={mapStyle}
          hoveredOperationalPointId={hoveredOperationalPointId}
          layersSettings={layersSettings}
          highlightedArea={highlightedArea}
        />
      )}

      <OSMLayers
        hidePlatforms={!layersSettings.platforms}
        mapStyle={mapStyle}
        showOSM={showOSM && mapIsLoaded}
        showOSM3dBuildings={showOSM3dBuildings && mapIsLoaded}
        showOSMtracksections={showOSMtracksections && mapIsLoaded}
      />
      <IGNLayers />

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
