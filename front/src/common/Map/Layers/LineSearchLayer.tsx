import React from 'react';

import { isNil } from 'lodash';
import { Source } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import { MAP_TRACK_SOURCES, MAP_URL } from 'common/Map/const';
import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import { getMap } from 'reducers/map/selectors';

interface TracksGeographicProps {
  layerOrder?: number;
  infraID: number | undefined;
}

const LineSearchLayer = ({ layerOrder, infraID }: TracksGeographicProps) => {
  const { lineSearchCode } = useSelector(getMap);

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
