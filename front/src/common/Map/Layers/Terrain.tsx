import { Source } from 'react-map-gl/maplibre';

export default function Terrain() {
  return (
    <Source
      id="terrain"
      type="raster-dem"
      encoding="terrarium"
      url="https://osm.osrd.fr/data/terrain.json"
      tileSize={256}
      maxzoom={12}
    />
  );
}
