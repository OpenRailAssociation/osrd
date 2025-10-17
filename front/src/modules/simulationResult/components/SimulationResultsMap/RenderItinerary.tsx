import type { Feature, LineString } from 'geojson';
import { Source } from 'react-map-gl/maplibre';

import type { GeoJsonLineString } from 'common/api/osrdEditoastApi';
import { OrderedLayer } from 'common/Map/Layers';

type ItineraryProps = {
  geojsonPath: Feature<LineString> | GeoJsonLineString;
  layerOrder: number;
};

const Itinerary = ({ geojsonPath, layerOrder }: ItineraryProps) => {
  const paintBackgroundLine = {
    'line-width': 5,
    'line-color': '#CEF6FF',
  };

  const paintLine = {
    'line-width': 1.5,
    'line-color': '#3C8AFF',
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
};

export default Itinerary;
