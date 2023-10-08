import React from 'react';
import { useSelector } from 'react-redux';
import { Source } from 'react-map-gl/maplibre';

import { MAP_TRACK_SOURCES, MAP_URL } from 'common/Map/const';
import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { getMap } from 'reducers/map/selectors';

interface TracksGeographicProps {
  layerOrder?: number;
}

function LineSearchLayer(props: TracksGeographicProps) {
  const { layerOrder } = props;
  const infraID = useSelector(getInfraID);
  const { lineSearchCode } = useSelector(getMap);
  const infraVersion = infraID !== undefined ? `?infra=${infraID}` : null;

  return infraVersion ? (
    <Source
      id="searchTrack-geo"
      type="vector"
      url={`${MAP_URL}/layer/track_sections/mvt/geo/${infraVersion}`}
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
          filter={['==', 'extensions_sncf_line_code', lineSearchCode]}
        />
      )}
    </Source>
  ) : null;
}

export default LineSearchLayer;
