import { Source } from 'react-map-gl/maplibre';

import { TERRAIN_URL } from 'common/Map/const';

function TerrainSource() {
  return (
    <Source
      id="terrain"
      type="raster-dem"
      encoding="terrarium"
      url={TERRAIN_URL}
      tileSize={256}
      maxzoom={12}
    />
  );
}

export default TerrainSource;
