import { Source } from 'react-map-gl/maplibre';

import type { GeoJsonLineString } from 'common/api/osrdEditoastApi';
import { OrderedLayer } from 'common/Map/Layers';

type ItineraryLayerProps = {
  layerOrder: number;
  geometry?: GeoJsonLineString;
  showStdcmAssets?: boolean;
  isFeasible?: boolean;
};

const FEASIBLE_COLOR = 'rgba(210, 225, 0, 0.75)';
const INFEASIBLE_COLOR = '#eaa72b';
const STDCM_ASSETS_COLOR = '#3c8aff';

export default function ItineraryLayer({
  layerOrder,
  geometry,
  showStdcmAssets = false,
  isFeasible = true,
}: ItineraryLayerProps) {
  if (!geometry) {
    return null;
  }

  const lineWidth = showStdcmAssets ? 1.5 : 5;

  let lineColor = FEASIBLE_COLOR;
  if (!isFeasible) {
    lineColor = INFEASIBLE_COLOR;
  } else if (showStdcmAssets) {
    lineColor = STDCM_ASSETS_COLOR;
  }

  return (
    <Source type="geojson" data={geometry}>
      {showStdcmAssets && (
        <OrderedLayer
          type="line"
          paint={{
            'line-width': 5,
            'line-color': '#CEF6FF',
          }}
          layerOrder={layerOrder}
        />
      )}
      <OrderedLayer
        type="line"
        paint={{
          'line-width': lineWidth,
          'line-color': lineColor,
        }}
        layerOrder={layerOrder}
      />
    </Source>
  );
}
