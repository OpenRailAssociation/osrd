import type { FeatureCollection } from 'geojson';
import { Source, Layer } from 'react-map-gl/maplibre';

type CircleLayer = {
  id: string;
  type: 'circle';
  paint: {
    'circle-radius': number;
    'circle-color': string;
    'circle-opacity'?: number;
  };
};

type GeoJsonLayerProps = {
  geometries: FeatureCollection;
};

const GeoJSONPointsLayer = ({ geometries }: GeoJsonLayerProps) => {
  const nElements = geometries.features.length;
  const opacity = Math.max(0.2, 50 / (100 + nElements));
  const layerStyle: CircleLayer = {
    id: 'geojson-layer',
    type: 'circle',
    paint: {
      'circle-radius': 10,
      'circle-color': '#007cbf',
      'circle-opacity': opacity,
    },
  };

  return (
    <Source id="geojson-layer" type="geojson" data={geometries}>
      <Layer {...layerStyle} />
    </Source>
  );
};

export default GeoJSONPointsLayer;
