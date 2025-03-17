import { Source } from 'react-map-gl/maplibre';

import { OSM_URL } from 'common/Map/const';

function OpenStreetMapSource() {
  return (
    <Source
      id="osm"
      type="vector"
      url={OSM_URL}
      attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    />
  );
}

export default OpenStreetMapSource;
