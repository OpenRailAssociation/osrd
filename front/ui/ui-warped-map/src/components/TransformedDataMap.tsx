import React, { type PropsWithChildren, useEffect, useMemo, useState } from 'react';

import { featureCollection } from '@turf/helpers';
import type { Feature, FeatureCollection, LineString } from 'geojson';
import { omit } from 'lodash';
import ReactMapGL, {
  Layer,
  type LayerProps,
  type LineLayerSpecification,
  type MapRef,
  Source,
  type StyleSpecification,
} from 'react-map-gl/maplibre';

import type { BBox2D, SourceDefinition } from '../core/types';

type TransformedDataMapProps = {
  bbox: BBox2D;
  mapStyle?: string | StyleSpecification;
  backgroundColor?: string;
  sources: SourceDefinition[];
  transformedData: Record<string, FeatureCollection>;
  path?: Feature<LineString>;
  pathLayer?: Omit<LineLayerSpecification, 'source-layer'>;
  log?: boolean;
};

/**
 * This component handles displaying warped data. The data must be warped before being given to this component.
 * Check `SimulationWarpedMap` to see an example use case.
 */
const TransformedDataMap = ({
  bbox,
  mapStyle,
  sources,
  transformedData,
  backgroundColor = 'white',
  path,
  pathLayer,
  log,
  children,
}: PropsWithChildren<TransformedDataMapProps>) => {
  const [mapRef, setMapRef] = useState<MapRef | null>(null);
  const pathCollection = useMemo(() => featureCollection(path ? [path] : []), [path]);
  const interactiveLayerIds = useMemo(
    () => sources.flatMap(({ layers }) => layers.map(({ id }) => id)),
    [sources]
  );

  // This effect handles the map initial position:
  useEffect(() => {
    if (!mapRef) return;

    const avgLon = (bbox[0] + bbox[2]) / 2;
    const thinBBox: BBox2D = [avgLon, bbox[1], avgLon, bbox[3]];
    setTimeout(() => {
      mapRef.fitBounds(thinBBox, { animate: false });
      mapRef.resize();
    }, 0);
  }, [mapRef, bbox]);

  return (
    <ReactMapGL
      ref={setMapRef}
      mapStyle={mapStyle}
      style={{ width: '100%', height: '100%' }}
      interactiveLayerIds={log ? interactiveLayerIds : []}
      onClick={({ features }) => {
        if (log)
          // eslint-disable-next-line no-console
          console.log(
            'Click transformed data map',
            !features?.length
              ? null
              : features.length === 1
                ? features[0]
                : featureCollection(features)
          );
      }}
    >
      <Layer type="background" paint={{ 'background-color': backgroundColor }} />
      {sources.map((source) => (
        <Source
          key={source.id}
          id={source.id}
          type="geojson"
          data={transformedData[source.id] || featureCollection([])}
        >
          {source.layers.map((layer) => {
            const sourceLayer = layer['source-layer'];
            const sourceLayerFilter = ['==', 'sourceLayer', sourceLayer];
            return (
              <Layer
                key={layer.id}
                {...({
                  ...omit(layer, 'source-layer'),
                  filter: layer.filter
                    ? ['all', layer.filter, sourceLayerFilter]
                    : sourceLayerFilter,
                } as LayerProps)}
              />
            );
          })}
        </Source>
      ))}
      {path && pathLayer && (
        <Source type="geojson" data={pathCollection}>
          <Layer {...(omit(pathLayer, 'source-layer') as LayerProps)} />
        </Source>
      )}
      {children}
    </ReactMapGL>
  );
};

export default TransformedDataMap;
