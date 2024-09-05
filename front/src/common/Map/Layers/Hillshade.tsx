import PropTypes from 'prop-types';
import { Source, type LayerProps } from 'react-map-gl/maplibre';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';

interface HillshadeProps {
  mapStyle: string;
  layerOrder?: number;
  display?: boolean;
}

function Hillshade({ mapStyle, layerOrder, display = true }: HillshadeProps) {
  const hillshadeParams: LayerProps = {
    id: 'osm/hillshade',
    source: 'hillshade',
    type: 'hillshade',
    paint: {},
  };

  return mapStyle !== 'normal' ? null : (
    <Source
      id="hillshade"
      type="raster-dem"
      encoding="terrarium"
      url="https://osm.osrd.fr/data/terrain.json"
      tileSize={256}
      maxzoom={12}
    >
      {display && <OrderedLayer {...hillshadeParams} layerOrder={layerOrder} />}
    </Source>
  );
}

Hillshade.propTypes = {
  mapStyle: PropTypes.string.isRequired,
};

export default Hillshade;
