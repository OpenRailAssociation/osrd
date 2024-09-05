import { Source, type LayerProps } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import { OSM_URL } from 'common/Map/const';
import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import type { RootState } from 'reducers';
import type { Theme } from 'types';

interface TracksOSMProps {
  colors: Theme;
  layerOrder: number;
}

function TracksOSM(props: TracksOSMProps) {
  const { showOSMtracksections } = useSelector((state: RootState) => state.map);
  const { colors, layerOrder } = props;

  const railwayMinor: LayerProps = {
    id: 'railwayMinor',
    type: 'line',
    source: 'openmaptiles',
    'source-layer': 'transportation',
    filter: ['all', ['==', ['get', 'class'], 'rail'], ['==', ['get', 'service'], 'yard']],
    layout: {
      visibility: 'visible',
    },
    paint: {
      'line-color': colors.tracksosm.minor,
    },
  };

  const railwayMajor: LayerProps = {
    id: 'railwayMajor',
    type: 'line',
    source: 'openmaptiles',
    'source-layer': 'transportation',
    filter: ['all', ['==', ['get', 'class'], 'rail'], ['!=', ['get', 'service'], 'yard']],
    layout: {
      visibility: 'visible',
    },
    paint: {
      'line-color': colors.tracksosm.major,
      'line-width': ['interpolate', ['linear'], ['zoom'], 15, 1, 17, 3],
    },
  };

  if (!showOSMtracksections) return null;
  return (
    <Source id="tracksOSM" type="vector" url={OSM_URL} source-layer="transportation">
      <OrderedLayer {...railwayMinor} layerOrder={layerOrder} />
      <OrderedLayer {...railwayMajor} layerOrder={layerOrder} />
    </Source>
  );
}

export default TracksOSM;
