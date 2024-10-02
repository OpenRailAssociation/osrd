import bbox from '@turf/bbox';
import html2canvas from 'html2canvas';
import { isEqual } from 'lodash';

import type { PathProperties } from 'common/api/osrdEditoastApi';
import { computeBBoxViewport } from 'common/Map/WarpedMap/core/helpers';
import type { Viewport } from 'reducers/map';

const captureMap = async (
  mapViewport: Viewport,
  mapId: string,
  setMapCanvas?: (mapCanvas: string) => void,
  pathGeometry?: NonNullable<PathProperties['geometry']>
) => {
  if (!pathGeometry) return;

  const itineraryViewport = computeBBoxViewport(bbox(pathGeometry), mapViewport);

  if (setMapCanvas && isEqual(mapViewport, itineraryViewport)) {
    try {
      const mapElement = document.getElementById(mapId);
      if (mapElement) {
        const canvas = await html2canvas(mapElement);
        setMapCanvas(canvas.toDataURL());
      }
    } catch (error) {
      console.error('Error capturing map:', error);
    }
  }
};

export default captureMap;
