import { Source } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import type { GeoJsonLineString } from 'common/api/osrdEditoastApi';
import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import { useOsrdConfSelectors } from 'common/osrdContext';

type ItineraryLayerProps = {
  layerOrder: number;
  geometry?: GeoJsonLineString;
  hideItineraryLine?: boolean;
};

export default function ItineraryLayer({
  layerOrder,
  geometry,
  hideItineraryLine = false,
}: ItineraryLayerProps) {
  const { getOrigin, getDestination } = useOsrdConfSelectors();
  const origin = useSelector(getOrigin);
  const destination = useSelector(getDestination);
  if (geometry && origin && destination) {
    return (
      <Source type="geojson" data={geometry}>
        {!hideItineraryLine && (
          <OrderedLayer
            type="line"
            paint={{
              'line-width': 5,
              'line-color': 'rgba(210, 225, 0, 0.75)',
            }}
            layerOrder={layerOrder}
          />
        )}
      </Source>
    );
  }
  return null;
}
