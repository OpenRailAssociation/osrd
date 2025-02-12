import { type LayerProps } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import { getTerrain3DExaggeration } from 'reducers/map/selectors';

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
  const terrain3DExaggeration = useSelector(getTerrain3DExaggeration);

  if (mapStyle !== 'normal' || terrain3DExaggeration === 0) {
    return null;
  }

  return <OrderedLayer {...hillshadeParams} layerOrder={layerOrder} />;
};

export default Hillshade;
