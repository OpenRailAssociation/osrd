import type { Feature, LineString } from 'geojson';
import { Source } from 'react-map-gl/maplibre';

import type { GeoJsonLineString } from 'common/api/osrdEditoastApi';
import { OrderedLayer } from 'common/Map/Layers';

type ItineraryProps = {
  geojsonPath: Feature<LineString> | GeoJsonLineString;
  layerOrder: number;
  idSuffix?: number | string;
  color?: string;
  backgroundColor?: string;
  /** Perpendicular offset in pixels, so overlapping paths can be drawn side by side. */
  offset?: number;
};

const Itinerary = ({
  geojsonPath,
  layerOrder,
  idSuffix = 'x',
  color = '#3C8AFF',
  backgroundColor = '#CEF6FF',
  offset = 0,
}: ItineraryProps) => {
  const paintBackgroundLine = {
    'line-width': 5,
    'line-color': backgroundColor,
    'line-offset': offset,
  };

  const paintLine = {
    'line-width': 1.5,
    'line-color': color,
    'line-offset': offset,
  };

  return (
    <Source type="geojson" data={geojsonPath}>
      <OrderedLayer
        id={`geojsonPathBackgroundLine-${idSuffix}`}
        type="line"
        paint={paintBackgroundLine}
        beforeId="geojsonPathLine"
        layerOrder={layerOrder}
      />
      <OrderedLayer
        id={`geojsonPathLine-${idSuffix}`}
        type="line"
        paint={paintLine}
        layerOrder={layerOrder}
      />
    </Source>
  );
};

export default Itinerary;
