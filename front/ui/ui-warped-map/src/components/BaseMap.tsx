import React, { type PropsWithChildren, useEffect, useMemo, useState } from 'react';

import { bbox } from '@turf/bbox';
import { featureCollection } from '@turf/helpers';
import type { Feature, LineString } from 'geojson';
import ReactMapGL, {
  Layer,
  type LayerProps,
  type MapRef,
  Source,
  type StyleSpecification,
} from 'react-map-gl/maplibre';

import { bboxAs2D } from '../core/helpers';
import { type SourceDefinition } from '../core/types';

type BaseMapProps = {
  path: Feature<LineString>;
  sources: SourceDefinition[];
  mapStyle?: string | StyleSpecification;
};

/**
 * This component is for testing purpose only. It displays data as they appear in the DataLoader component.
 */
const BaseMap = ({ path, mapStyle, sources, children }: PropsWithChildren<BaseMapProps>) => {
  const [mapRef, setMapRef] = useState<MapRef | null>(null);
  const interactiveLayerIds = useMemo(
    () => sources.flatMap(({ layers }) => layers.map(({ id }) => id)),
    [sources]
  );

  // This effect handles the map initial position:
  useEffect(() => {
    if (!mapRef || !path) return;

    setTimeout(() => {
      mapRef.fitBounds(bboxAs2D(bbox(path)), { animate: false });
      mapRef.resize();
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapRef]);

  return (
    <ReactMapGL
      ref={setMapRef}
      mapStyle={mapStyle}
      style={{ width: '100%', height: '100%' }}
      interactiveLayerIds={interactiveLayerIds}
      onClick={({ features }) => {
        if (features?.length)
          // eslint-disable-next-line no-console
          console.log(
            'Click base map',
            !features?.length
              ? null
              : features.length === 1
                ? features[0]
                : featureCollection(features)
          );
      }}
    >
      <Layer type="background" paint={{ 'background-color': 'white' }} />
      {sources.map(({ id, url, layers }) => (
        <Source key={id} id={id} type="vector" url={url}>
          {layers.map(({ id: layerId, ...layerProps }) => (
            <Layer key={layerId} id={layerId} {...(layerProps as LayerProps)} />
          ))}
        </Source>
      ))}
      {children}
    </ReactMapGL>
  );
};

export default BaseMap;
