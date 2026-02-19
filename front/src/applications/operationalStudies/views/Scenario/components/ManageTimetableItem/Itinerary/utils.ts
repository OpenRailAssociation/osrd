import bbox from '@turf/bbox';
import type { Position } from 'geojson';

import { computeBBoxViewport } from 'common/Map/WarpedMap/core/helpers';
import type { Viewport } from 'reducers/commonMap/types';
import type { PathStepMetadata } from 'reducers/osrdconf/types';

export const isOpRefMetadata = (pathStepMetadata: PathStepMetadata | undefined) =>
  !!pathStepMetadata && !pathStepMetadata.isInvalid && pathStepMetadata.type === 'opRef';

export const computeOpRefMarkerName = (
  pathStepMetadata: Extract<PathStepMetadata, { isInvalid: false; type: 'opRef' }>
) =>
  `${pathStepMetadata.name}${pathStepMetadata.secondaryCode ? ` ${pathStepMetadata.secondaryCode}` : ''}${pathStepMetadata.trackName ? ` \u00B7 ${pathStepMetadata.trackName}` : ''}`;

export const computePathStepCoordinates = (pathStepMetadata: PathStepMetadata) => {
  if (pathStepMetadata.isInvalid) return [];
  if (pathStepMetadata.type === 'trackOffset') {
    return [pathStepMetadata.coordinates];
  }
  if (pathStepMetadata.secondaryCode && pathStepMetadata.trackName) {
    const foundPart = pathStepMetadata.parts.find(
      (part) => part.trackName === pathStepMetadata.trackName
    );
    return foundPart ? [foundPart.coordinates] : [];
  }
  if (pathStepMetadata.secondaryCode) {
    return pathStepMetadata.parts.map((part) => part.coordinates);
  }
  // If the path step has no secondary code, don't display its marker on the map
  return [];
};

export const computeViewportForCoordinates = (
  coordinates: Position[],
  currentViewport: Viewport
): Partial<Viewport> | null => {
  if (coordinates.length === 0) return null;
  if (coordinates.length === 1) {
    return { longitude: coordinates[0][0], latitude: coordinates[0][1], zoom: 16 };
  }
  return computeBBoxViewport(bbox({ type: 'MultiPoint', coordinates }), currentViewport);
};
