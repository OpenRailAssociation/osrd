import { isNil } from 'lodash';
import { Source } from 'react-map-gl/maplibre';
import type { CircleLayer, SymbolLayer } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import { MAP_URL } from 'common/Map/const';
import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import { getLayersSettings } from 'reducers/map/selectors';
import type { Theme, OmitLayer } from 'types';

export function getDetectorsLayerProps(params: {
  colors: Theme;
  sourceTable?: string;
}): OmitLayer<CircleLayer> {
  const res: OmitLayer<CircleLayer> = {
    type: 'circle',
    minzoom: 8,
    paint: {
      'circle-stroke-color': params.colors.detectors.circle,
      'circle-color': params.colors.detectors.circle,
      'circle-radius': 4,
    },
  };

  if (typeof params.sourceTable === 'string') res['source-layer'] = params.sourceTable;
  return res;
}

export function getDetectorsNameLayerProps(params: {
  colors: Theme;
  sourceTable?: string;
}): OmitLayer<SymbolLayer> {
  const res: OmitLayer<SymbolLayer> = {
    type: 'symbol',
    minzoom: 8,
    layout: {
      'text-field': '{extensions_sncf_kp}',
      'text-font': ['Roboto Condensed'],
      'text-size': 10,
      'text-anchor': 'left',
      'text-allow-overlap': false,
      'text-ignore-placement': false,
      'text-offset': [0.5, 0.2],
      visibility: 'visible',
    },
    paint: {
      'text-color': params.colors.detectors.text,
      'text-halo-width': 1,
      'text-halo-color': params.colors.detectors.halo,
      'text-halo-blur': 1,
    },
  };

  if (typeof params.sourceTable === 'string') res['source-layer'] = params.sourceTable;
  return res;
}

interface DetectorsProps {
  colors: Theme;
  layerOrder: number;
  infraID: number | undefined;
}

const Detectors = ({ colors, layerOrder, infraID }: DetectorsProps) => {
  const layersSettings = useSelector(getLayersSettings);

  const layerPoint = getDetectorsLayerProps({ colors, sourceTable: 'detectors' });
  const layerName = getDetectorsNameLayerProps({ colors, sourceTable: 'detectors' });

  if (!layersSettings.detectors || isNil(infraID)) return null;
  return (
    <Source
      id="osrd_detectors_geo"
      type="vector"
      url={`${MAP_URL}/layer/detectors/mvt/geo/?infra=${infraID}`}
    >
      <OrderedLayer {...layerPoint} id="chartis/osrd_detectors/geo" layerOrder={layerOrder} />
      <OrderedLayer {...layerName} id="chartis/osrd_detectors_name/geo" layerOrder={layerOrder} />
    </Source>
  );
};

export default Detectors;
