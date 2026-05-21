import { useCallback, useMemo, useRef, useState } from 'react';

import bbox from '@turf/bbox';
import type { Feature, FeatureCollection, Point } from 'geojson';
import type { LngLatBoundsLike, MapLayerMouseEvent } from 'maplibre-gl';
import type { MapRef } from 'react-map-gl/maplibre';
import ReactMapGL, { Source } from 'react-map-gl/maplibre';

import type {
  SimDebugConflictReport,
  SimDebugData,
  SimDebugFailureReport,
} from 'common/api/osrdEditoastApi';
import { OrderedLayer, VirtualLayers, genOSMLayerProps, useMapBlankStyle } from 'common/Map/Layers';
import OpenStreetMapSource from 'common/Map/Sources/OpenStreetMap';
import { LAYER_GROUPS_ORDER, LAYERS } from 'config/layerOrder';

type HoveredPoint = SimDebugConflictReport & { category: 'largest' | 'closest' };

const toFeatures = (
  points: SimDebugConflictReport[],
  category: 'largest' | 'closest'
): Feature<Point>[] =>
  points.map(({ path_geometry: _, ...point }, i) => ({
    type: 'Feature',
    id: i,
    properties: { ...point, category },
    geometry: { type: 'Point', coordinates: [point.lon, point.lat] },
  }));

const fmtSeconds = (seconds: number) => `${Math.round(seconds)}s`;

type DebugMapProps = {
  failureData?: SimDebugFailureReport;
  simulationData?: SimDebugData;
};

const DebugMap = ({ failureData, simulationData }: DebugMapProps) => {
  const mapRef = useRef<MapRef | null>(null);
  const mapBlankStyle = useMapBlankStyle();
  const [hovered, setHovered] = useState<{
    point: HoveredPoint;
    clientX: number;
    clientY: number;
  } | null>(null);

  const geojson = useMemo<FeatureCollection<Point>>(
    () => ({
      type: 'FeatureCollection',
      features: [
        ...toFeatures(failureData?.largest_conflicts ?? [], 'largest'),
        ...toFeatures(failureData?.closest_conflicts ?? [], 'closest'),
      ],
    }),
    [failureData]
  );

  const initialViewState = useMemo(() => {
    const fitBoundsOptions = { padding: 50, maxZoom: 12 };
    if (simulationData?.path_properties.geometry) {
      const [minLon, minLat, maxLon, maxLat] = bbox(simulationData.path_properties.geometry);
      const bounds: LngLatBoundsLike = [
        [minLon, minLat],
        [maxLon, maxLat],
      ];
      return { bounds, fitBoundsOptions };
    }
    const allPoints = [
      ...(failureData?.largest_conflicts ?? []),
      ...(failureData?.closest_conflicts ?? []),
    ];
    if (allPoints.length === 0) return { latitude: 46.2, longitude: 2.5, zoom: 5 };
    const lats = allPoints.map((point) => point.lat);
    const lons = allPoints.map((point) => point.lon);
    const bounds: LngLatBoundsLike = [
      [Math.min(...lons), Math.min(...lats)],
      [Math.max(...lons), Math.max(...lats)],
    ];
    return { bounds, fitBoundsOptions };
  }, [failureData, simulationData]);

  const handleMouseMove = useCallback(
    (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature) {
        setHovered(null);
        return;
      }
      const category = feature.properties?.category as 'largest' | 'closest';
      const id = feature.id as number;
      const conflicts =
        category === 'largest' ? failureData?.largest_conflicts : failureData?.closest_conflicts;
      const point = conflicts?.[id];
      if (!point) {
        setHovered(null);
        return;
      }
      setHovered({ point: { ...point, category }, clientX: event.point.x, clientY: event.point.y });
    },
    [failureData]
  );

  return (
    <div className="debug-map">
      <div className="debug-map__map">
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
            .filter((layer): layer is typeof layer & { id: string } => layer.id !== undefined)
            .map(({ id, ...props }) => (
              <OrderedLayer key={id} id={id} {...props} />
            ))}
          {simulationData?.path_properties.geometry && !hovered && (
            <Source
              id="success-path"
              type="geojson"
              data={{
                type: 'Feature',
                geometry: simulationData.path_properties.geometry,
                properties: {},
              }}
            >
              <OrderedLayer
                id="success-path-line"
                type="line"
                layerOrder={LAYER_GROUPS_ORDER[LAYERS.PATH.GROUP]}
                paint={{ 'line-color': 'rgba(0, 100, 220, 0.8)', 'line-width': 3 }}
              />
            </Source>
          )}
          {hovered?.point.path_geometry && (
            <Source
              id="conflict-path"
              type="geojson"
              data={{ type: 'Feature', geometry: hovered.point.path_geometry, properties: {} }}
            >
              <OrderedLayer
                id="conflict-path-line"
                type="line"
                layerOrder={LAYER_GROUPS_ORDER[LAYERS.PATH.GROUP]}
                paint={{ 'line-color': 'rgba(220, 80, 0, 0.8)', 'line-width': 2.5 }}
              />
            </Source>
          )}
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
      </div>

      <div className="debug-map__legend">
        <span>
          <span className="debug-map__legend-dot debug-map__legend-dot--largest" />
          Largest conflicts
        </span>
        <span>
          <span className="debug-map__legend-dot debug-map__legend-dot--closest" />
          Closest conflicts
        </span>
      </div>

      {hovered && (
        <div
          className="debug-map__tooltip"
          style={{ left: hovered.clientX + 12, top: hovered.clientY + 12 }}
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

export default DebugMap;
