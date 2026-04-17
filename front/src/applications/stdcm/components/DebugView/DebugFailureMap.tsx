import { useCallback, useMemo, useRef, useState } from 'react';

import type { Feature, FeatureCollection, Point } from 'geojson';
import type { MapLayerMouseEvent } from 'maplibre-gl';
import type { MapRef } from 'react-map-gl/maplibre';
import ReactMapGL, { Source } from 'react-map-gl/maplibre';

import { OrderedLayer, VirtualLayers, genOSMLayerProps, useMapBlankStyle } from 'common/Map/Layers';
import OpenStreetMapSource from 'common/Map/Sources/OpenStreetMap';
import { LAYER_GROUPS_ORDER, LAYERS } from 'config/layerOrder';

type ConflictPoint = {
  at: string;
  time_lost: number;
  best_remaining_time: number;
  current_travel_time: number;
  caused_by: string;
  lat: number;
  lon: number;
  lastOPName: string;
};

type FailureData = {
  largest_conflicts: ConflictPoint[];
  closest_conflicts: ConflictPoint[];
};

type HoveredPoint = ConflictPoint & { category: 'largest' | 'closest' };

const toFeatures = (points: ConflictPoint[], category: 'largest' | 'closest'): Feature<Point>[] =>
  points.map((p, i) => ({
    type: 'Feature',
    id: i,
    properties: { ...p, category },
    geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
  }));

const fmtSeconds = (s: number) => `${Math.round(s)}s`;

type DebugFailureMapProps = { failureData: unknown };

const DebugFailureMap = ({ failureData }: DebugFailureMapProps) => {
  const data = failureData as FailureData;
  const mapRef = useRef<MapRef | null>(null);
  const mapBlankStyle = useMapBlankStyle();
  const [hovered, setHovered] = useState<{ point: HoveredPoint; x: number; y: number } | null>(
    null
  );

  const geojson = useMemo<FeatureCollection<Point>>(
    () => ({
      type: 'FeatureCollection',
      features: [
        ...toFeatures(data.largest_conflicts ?? [], 'largest'),
        ...toFeatures(data.closest_conflicts ?? [], 'closest'),
      ],
    }),
    [data]
  );

  const initialViewState = useMemo(() => {
    const allPoints = [...(data.largest_conflicts ?? []), ...(data.closest_conflicts ?? [])];
    if (allPoints.length === 0) return { latitude: 46.2, longitude: 2.5, zoom: 5 };
    const lats = allPoints.map((p) => p.lat);
    const lons = allPoints.map((p) => p.lon);
    return {
      latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
      longitude: (Math.min(...lons) + Math.max(...lons)) / 2,
      zoom: 8,
    };
  }, [data]);

  const handleMouseMove = useCallback((e: MapLayerMouseEvent) => {
    const feature = e.features?.[0];
    if (!feature) {
      setHovered(null);
      return;
    }
    setHovered({
      point: feature.properties as HoveredPoint,
      x: e.point.x,
      y: e.point.y,
    });
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: 500 }}>
      <ReactMapGL
        ref={mapRef}
        initialViewState={initialViewState}
        style={{ width: '100%', height: '100%' }}
        mapStyle={mapBlankStyle}
        interactiveLayerIds={['conflicts-largest', 'conflicts-closest']}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHovered(null)}
      >
        <VirtualLayers />
        <OpenStreetMapSource />
        {genOSMLayerProps(
          'normal',
          { showOSM3dBuildings: false },
          LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]
        )
          .filter((p): p is typeof p & { id: string } => p.id !== undefined)
          .map(({ id, ...props }) => (
            <OrderedLayer key={id} id={id} {...props} />
          ))}
        <Source id="conflicts" type="geojson" data={geojson}>
          <OrderedLayer
            id="conflicts-largest"
            type="circle"
            layerOrder={LAYER_GROUPS_ORDER[LAYERS.OPERATIONAL_POINTS.GROUP]}
            filter={['==', ['get', 'category'], 'largest']}
            paint={{
              'circle-radius': 8,
              'circle-color': 'rgba(220, 50, 50, 0.85)',
              'circle-stroke-width': 1.5,
              'circle-stroke-color': '#fff',
            }}
          />
          <OrderedLayer
            id="conflicts-closest"
            type="circle"
            layerOrder={LAYER_GROUPS_ORDER[LAYERS.OPERATIONAL_POINTS.GROUP]}
            filter={['==', ['get', 'category'], 'closest']}
            paint={{
              'circle-radius': 8,
              'circle-color': 'rgba(50, 120, 220, 0.85)',
              'circle-stroke-width': 1.5,
              'circle-stroke-color': '#fff',
            }}
          />
        </Source>
      </ReactMapGL>

      <div
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          background: 'white',
          border: '1px solid #ccc',
          padding: '4px 8px',
          fontSize: 12,
          display: 'flex',
          gap: 12,
        }}
      >
        <span>
          <span
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: 'rgba(220,50,50,0.85)',
              marginRight: 4,
            }}
          />
          Largest conflicts
        </span>
        <span>
          <span
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: 'rgba(50,120,220,0.85)',
              marginRight: 4,
            }}
          />
          Closest conflicts
        </span>
      </div>

      {hovered && (
        <div
          style={{
            position: 'absolute',
            left: hovered.x + 12,
            top: hovered.y + 12,
            background: 'white',
            border: '1px solid #ccc',
            padding: '6px 10px',
            pointerEvents: 'none',
            fontSize: 12,
            maxWidth: 280,
            lineHeight: 1.6,
          }}
        >
          <div>
            <strong>{hovered.point.lastOPName}</strong>
          </div>
          <div>at: {hovered.point.at}</div>
          <div>caused by: {hovered.point.caused_by}</div>
          <div>time lost: {fmtSeconds(hovered.point.time_lost)}</div>
          <div>best remaining: {fmtSeconds(hovered.point.best_remaining_time)}</div>
          <div>travel time: {fmtSeconds(hovered.point.current_travel_time)}</div>
        </div>
      )}
    </div>
  );
};

export default DebugFailureMap;
