import { Source, type LayerProps } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import { getTerrain3DExaggeration } from 'reducers/map/selectors';

type HillshadeProps = {
  mapStyle: string;
  layerOrder?: number;
  display?: boolean;
};

const hillshadeParams: LayerProps = {
  id: 'osm/hillshade',
  source: 'hillshade',
  type: 'hillshade',
  paint: {},
};

const Hillshade = ({ mapStyle, layerOrder }: HillshadeProps) => {
  const terrain3DExaggeration = useSelector(getTerrain3DExaggeration);

  if (mapStyle !== 'normal' || terrain3DExaggeration === 0) {
    return null;
  }

  return (
    <Source
      id="hillshade"
      type="raster-dem"
      encoding="terrarium"
      url="https://osm.osrd.fr/data/terrain.json"
      tileSize={256}
      maxzoom={12}
    >
      <OrderedLayer {...hillshadeParams} layerOrder={layerOrder} />
    </Source>
  );
};

export default Hillshade;
