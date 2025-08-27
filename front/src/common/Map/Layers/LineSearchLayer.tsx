import { isNil } from 'lodash';
import { Source } from 'react-map-gl/maplibre';

import { MAP_TRACK_SOURCES, MAP_URL } from 'common/Map/const';

import OrderedLayer from './OrderedLayer';

type TracksGeographicProps = {
  layerOrder?: number;
  infraID: number | undefined;
  lineSearchCode?: number;
};

const LineSearchLayer = ({ layerOrder, infraID, lineSearchCode }: TracksGeographicProps) => {
  if (isNil(infraID)) return null;
  return (
    <Source
      id="searchTrack-geo"
      type="vector"
      url={`${MAP_URL}/layer/track_sections/mvt/geo/?infra=${infraID}`}
      source-layer={MAP_TRACK_SOURCES.geographic}
    >
      {lineSearchCode && (
        <OrderedLayer
          source-layer={MAP_TRACK_SOURCES.geographic}
          layerOrder={layerOrder}
          id="lineSearchLayer-geo"
          type="line"
          paint={{
            'line-color': '#ffb612',
            'line-width': 4,
          }}
          filter={['==', ['get', 'extensions_sncf_line_code'], lineSearchCode]}
        />
      )}
    </Source>
  );
};

export default LineSearchLayer;
