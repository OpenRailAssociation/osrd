import type { Feature, LineString } from 'geojson';
import { Source } from 'react-map-gl/maplibre';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';

interface RenderItineraryProps {
  geojsonPath: Feature<LineString>;
  layerOrder: number;
}

export default function RenderItinerary(props: RenderItineraryProps) {
  const { geojsonPath, layerOrder } = props;

  const paint = {
    'line-width': 3,
    'line-color': '#82be00',
  };

  return (
    <Source type="geojson" data={geojsonPath}>
      <OrderedLayer id="geojsonPath" type="line" paint={paint} layerOrder={layerOrder} />
    </Source>
  );
}
