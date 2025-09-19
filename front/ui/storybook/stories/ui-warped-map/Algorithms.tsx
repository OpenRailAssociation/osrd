import React, { useMemo } from 'react';

import {
  BaseMap,
  Loader,
  WarpedMap,
  getWarping,
  type WarpingOptions,
  type SourceDefinition,
} from '@osrd-project/ui-warped-map';
import { featureCollection } from '@turf/helpers';
import type { Feature, LineString } from 'geojson';
import { Layer, type LineLayerSpecification, Source } from 'react-map-gl/maplibre';

import { OSM_BASE_MAP_STYLE, OSM_SOURCE } from './helpers';
import { useAsyncMemo } from './useAsyncMemo';

const SOURCES: SourceDefinition[] = [OSM_SOURCE];

const PATH_LAYER: Omit<LineLayerSpecification, 'source-layer'> = {
  id: 'path-layer',
  source: 'path',
  type: 'line',
  paint: {
    'line-width': 1,
    'line-color': 'blue',
  },
};

type AlgorithmsShowcaseProps = {
  path: Feature<LineString>;
  warpingOptions: WarpingOptions;
};

const AlgorithmsShowcase = ({ path, warpingOptions }: AlgorithmsShowcaseProps) => {
  const { grid, warpedGrid } = useMemo(
    () => getWarping(path, warpingOptions),
    [path, warpingOptions]
  );
  const pathCollection = useMemo(() => featureCollection([path]), [path]);

  return (
    <div
      style={{
        background: 'lightgrey',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        position: 'absolute',
        inset: 0,
      }}
    >
      <div style={{ marginRight: '1em', flexGrow: 1 }}>
        <BaseMap path={path} sources={SOURCES} mapStyle={OSM_BASE_MAP_STYLE}>
          <Source type="geojson" data={pathCollection}>
            <Layer
              id="path-layer"
              source="path"
              type="line"
              paint={{
                'line-width': 1,
                'line-color': 'blue',
              }}
            />
          </Source>
          <Source type="geojson" data={grid}>
            <Layer
              id="grid-layer"
              source="grid"
              type="line"
              paint={{
                'line-width': 1,
                'line-color': 'red',
              }}
            />
          </Source>
        </BaseMap>
      </div>
      <div style={{ flexGrow: 1 }}>
        <WarpedMap
          log
          path={path}
          pathLayer={PATH_LAYER}
          sources={SOURCES}
          mapStyle={OSM_BASE_MAP_STYLE}
          warpingOptions={warpingOptions}
        >
          <Source type="geojson" data={warpedGrid}>
            <Layer
              id="grid-layer"
              source="grid"
              type="line"
              paint={{
                'line-width': 1,
                'line-color': 'red',
              }}
            />
          </Source>
        </WarpedMap>
      </div>
    </div>
  );
};

const Algorithms = (props: { path: string } & WarpingOptions) => {
  const { path: pathName, ...warpingOptions } = props;
  const pathState = useAsyncMemo(
    () => fetch(`./${pathName}.json`).then((res) => res.json() as Promise<Feature<LineString>>),
    [pathName]
  );
  const path = pathState.type === 'ready' ? pathState.data : null;

  if (!path) return <Loader />;

  return <AlgorithmsShowcase key={pathName} path={path} warpingOptions={warpingOptions} />;
};

export default Algorithms;
