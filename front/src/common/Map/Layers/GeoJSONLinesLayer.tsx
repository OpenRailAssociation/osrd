import type { FeatureCollection } from 'geojson';
import { Source, Layer } from 'react-map-gl/maplibre';

type LineLayer = {
  id: string;
  type: 'line';
  paint: {
    'line-color': string;
    'line-width': number;
    'line-opacity'?: number;
  };
};

type GeoJsonLayerProps = {
  geometries: FeatureCollection;
};

const GeoJSONLinesLayer = ({ geometries }: GeoJsonLayerProps) => {
  const nElements = geometries.features.length;
  const opacity = Math.max(0.1, 10 / (20 + nElements));
  const layerStyle: LineLayer = {
    id: 'geojson-line-layer',
    type: 'line',
    paint: {
      'line-width': 2,
      'line-color': '#007cbf',
      'line-opacity': opacity,
    },
  };

  return (
    <Source id="geojson-layer" type="geojson" data={geometries}>
      <Layer {...layerStyle} />
    </Source>
  );
};

export default GeoJSONLinesLayer;
