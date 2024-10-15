import PropTypes from 'prop-types';
import { Source, type LayerProps } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import { getTerrain3DExaggeration } from 'reducers/map/selectors';

interface HillshadeProps {
  mapStyle: string;
  layerOrder?: number;
  display?: boolean;
}

function Hillshade({ mapStyle, layerOrder }: HillshadeProps) {
  const terrain3DExaggeration = useSelector(getTerrain3DExaggeration);

  const hillshadeParams: LayerProps = {
    id: 'osm/hillshade',
    source: 'hillshade',
    type: 'hillshade',
    paint: {},
  };

  return mapStyle !== 'normal' || terrain3DExaggeration === 0 ? null : (
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
}

Hillshade.propTypes = {
  mapStyle: PropTypes.string.isRequired,
};

export default Hillshade;
