import { type LayerProps } from 'react-map-gl/maplibre';

import { useMapSettings } from 'reducers/commonMap';

import OrderedLayer from './OrderedLayer';

type HillshadeProps = {
  mapStyle: string;
  layerOrder?: number;
  display?: boolean;
};

const hillshadeParams: LayerProps = {
  id: 'osm/hillshade',
  source: 'terrain',
  type: 'hillshade',
  paint: {},
};

const Hillshade = ({ mapStyle, layerOrder }: HillshadeProps) => {
  const { terrain3DExaggeration } = useMapSettings();
  if (mapStyle !== 'normal' || !terrain3DExaggeration) {
    return null;
  }
  return <OrderedLayer {...hillshadeParams} layerOrder={layerOrder} />;
};

export default Hillshade;
