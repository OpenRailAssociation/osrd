import React, { type ComponentType, type PropsWithChildren, useEffect, useState } from 'react';

import { bbox } from '@turf/bbox';
import type { Feature, FeatureCollection, LineString } from 'geojson';
import { isNil, mapValues, omitBy } from 'lodash';
import { type LineLayerSpecification, type StyleSpecification } from 'react-map-gl/maplibre';

import DataLoader from './DataLoader';
import Loader from './Loader';
import TransformedDataMap from './TransformedDataMap';
import getWarping, { type WarpingFunction, type WarpingOptions } from '../core/getWarping';
import { bboxAs2D } from '../core/helpers';
import type { BBox2D, SourceDefinition } from '../core/types';

const TIME_LABEL = 'Warping data';

interface PathStatePayload {
  path: Feature<LineString>;
  warpedPath: Feature<LineString>;
  pathBBox: BBox2D;
  warpedPathBBox: BBox2D;
  transform: WarpingFunction;
}

type Components = Record<'loader', ComponentType>;
const DEFAULT_COMPONENTS: Components = {
  loader: Loader,
};

type WarpedMapProps = {
  path: Feature<LineString>;
  pathLayer?: Omit<LineLayerSpecification, 'source-layer'>;
  sources: SourceDefinition[];
  components?: Partial<Components>;
  mapStyle?: string | StyleSpecification;
  warpingOptions?: WarpingOptions;
  log?: boolean;
};

/**
 * This component handles loading all data along a given path on various sources, and then displays them on a map (using
 * TransformedDataMap):
 */
const WarpedMap = ({
  path,
  pathLayer,
  sources,
  components: partialComponents = {},
  mapStyle,
  warpingOptions,
  log,
  children,
}: PropsWithChildren<WarpedMapProps>) => {
  const [state, setState] = useState<
    | { type: 'idle' }
    | { type: 'loading' }
    | { type: 'error'; message?: string }
    | ({
        type: 'pathLoaded';
      } & PathStatePayload)
    | ({
        type: 'dataLoaded';
      } & PathStatePayload & {
          data: Record<string, FeatureCollection>;
          transformedData: Record<string, FeatureCollection>;
        })
  >({ type: 'idle' });
  const components: Components = {
    ...DEFAULT_COMPONENTS,
    ...partialComponents,
  };

  /**
   * This effect handles reading the path, and retrieve the warping function:
   */
  useEffect(() => {
    const pathBBox = bboxAs2D(bbox(path));
    const { warpedPathBBox, transform } = getWarping(path, warpingOptions);
    const warpedPath = transform(path) as typeof path;

    setState({ type: 'pathLoaded', path, warpedPath, pathBBox, warpedPathBBox, transform });
  }, [path, warpingOptions]);

  return (
    <>
      {state.type === 'pathLoaded' && (
        <DataLoader
          log={log}
          mapStyle={mapStyle}
          bbox={state.pathBBox}
          sources={sources}
          timeout={3000}
          onDataLoaded={(data) => {
            // eslint-disable-next-line no-console
            if (log) console.time(TIME_LABEL);
            const transformedData = omitBy(
              mapValues(data, (collection) => (collection ? state.transform(collection) : null)),
              isNil
            ) as typeof data;
            // eslint-disable-next-line no-console
            if (log) console.timeEnd(TIME_LABEL);
            setState({ ...state, data, transformedData, type: 'dataLoaded' });
          }}
        />
      )}
      {state.type !== 'dataLoaded' && <components.loader />}
      {state.type === 'dataLoaded' && (
        <TransformedDataMap
          log={log}
          mapStyle={mapStyle}
          bbox={state.warpedPathBBox}
          sources={sources}
          transformedData={state.transformedData}
          path={state.warpedPath}
          pathLayer={pathLayer}
        >
          {children}
        </TransformedDataMap>
      )}
    </>
  );
};

export default WarpedMap;
