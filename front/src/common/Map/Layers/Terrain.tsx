import { Source } from 'react-map-gl/maplibre';

import { TERRAIN_URL } from 'common/Map/const';

export default function Terrain() {
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
