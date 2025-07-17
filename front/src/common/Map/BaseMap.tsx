import { type MutableRefObject, type PropsWithChildren, useEffect, useState } from 'react';

import type { Geometry } from 'geojson';
import type { MapLayerMouseEvent, MapLibreEvent } from 'maplibre-gl';
import ReactMapGL, { AttributionControl, ScaleControl } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import { useParams } from 'react-router-dom';

import colors from 'common/Map/Consts/colors';
import {
  IGNLayers,
  InfraObjectLayers,
  LineSearchLayer,
  OSMLayers,
  SearchMarker,
  VirtualLayers,
  useMapBlankStyle,
} from 'common/Map/Layers';
import { LAYER_GROUPS_ORDER, LAYERS } from 'config/layerOrder';
import type { MapState, Viewport } from 'reducers/map';

import { CUSTOM_ATTRIBUTION } from './const';

type MapProps = Pick<MapState, 'layersSettings' | 'mapSearchMarker' | 'mapStyle' | 'showOSM'> & {
  mapId: string;
  mapRef: MutableRefObject<MapRef | null>;
  interactiveLayerIds: string[];
  infraId?: number;
  terrain3DExaggeration?: number;
  viewPort: Viewport;
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
};

const BaseMap = ({
  mapId,
  mapRef,
  children,
  interactiveLayerIds,
  viewPort,
  infraId,
  mapSearchMarker,
  mapStyle,
  showOSM,
  cursor = 'default',
  hideAttribution = false,
  hoveredOperationalPointId,
  terrain3DExaggeration,
  updatePartialViewPort,
  onClick,
  onMouseEnter,
  onMouseMove,
  onIdle,
  layersSettings,
  highlightedArea,
}: PropsWithChildren<MapProps>) => {
  const mapBlankStyle = useMapBlankStyle();

  const [mapIsLoaded, setMapIsLoaded] = useState(false);

  const { urlLat = '', urlLon = '', urlZoom = '', urlBearing = '', urlPitch = '' } = useParams();

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ReactMapGL
      id={mapId}
      ref={mapRef}
      {...viewPort}
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
        />
      )}

      <OSMLayers
        hidePlatforms={!layersSettings.platforms}
        mapStyle={mapStyle}
        showOSM={showOSM && mapIsLoaded}
      />
      <IGNLayers />

      <LineSearchLayer
        layerOrder={LAYER_GROUPS_ORDER[LAYERS.LINE_SEARCH.GROUP]}
        infraID={infraId}
      />

      {mapSearchMarker && <SearchMarker data={mapSearchMarker} colors={colors[mapStyle]} />}

      {children}
    </ReactMapGL>
  );
};

export default BaseMap;
