import type { Feature, LineString } from 'geojson';
import { Source } from 'react-map-gl/maplibre';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';

interface RenderItineraryProps {
  geojsonPath: Feature<LineString>;
  layerOrder: number;
}

export default function RenderItinerary(props: RenderItineraryProps) {
  const { geojsonPath, layerOrder } = props;

  const paintBackgroundLine = {
    'line-width': 4,
    'line-color': '#EDF9FF',
  };

  const paintLine = {
    'line-width': 1,
    'line-color': '#158DCF',
  };

  return (
    <Source type="geojson" data={geojsonPath}>
      <OrderedLayer
        id="geojsonPathBackgroundLine"
        type="line"
        paint={paintBackgroundLine}
        beforeId="geojsonPathLine"
        layerOrder={layerOrder}
      />
      <OrderedLayer id="geojsonPathLine" type="line" paint={paintLine} layerOrder={layerOrder} />
    </Source>
  );
}
