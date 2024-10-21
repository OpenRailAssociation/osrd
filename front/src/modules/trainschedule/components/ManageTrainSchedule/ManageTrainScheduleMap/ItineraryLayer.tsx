import { Source } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import type { GeoJsonLineString } from 'common/api/osrdEditoastApi';
import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import { useOsrdConfSelectors } from 'common/osrdContext';

type ItineraryLayerProps = {
  layerOrder: number;
  geometry?: GeoJsonLineString;
  hideItineraryLine?: boolean;
  showStdcmAssets: boolean;
  isNonFeasible?: boolean;
};

export default function ItineraryLayer({
  layerOrder,
  geometry,
  hideItineraryLine = false,
  showStdcmAssets,
  isNonFeasible,
}: ItineraryLayerProps) {
  const { getOrigin, getDestination } = useOsrdConfSelectors();
  const origin = useSelector(getOrigin);
  const destination = useSelector(getDestination);
  if (geometry && origin && destination) {
    const lineWidth = showStdcmAssets ? 3 : 5;
    let lineColor = 'rgba(210, 225, 0, 0.75)';
    if (isNonFeasible) {
      lineColor = '#eaa72b';
    } else if (showStdcmAssets) {
      lineColor = 'rgba(21, 141, 207, 1)';
    }
    return (
      <Source type="geojson" data={geometry}>
        {!hideItineraryLine && (
          <OrderedLayer
            type="line"
            paint={{
              'line-width': lineWidth,
              'line-color': lineColor,
            }}
            layerOrder={layerOrder}
          />
        )}
      </Source>
    );
  }
  return null;
}
