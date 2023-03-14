import React from 'react';
import { useSelector } from 'react-redux';
import { Source } from 'react-map-gl';

import { RootState } from 'reducers';
import { Theme } from 'types';

import { MAP_TRACK_SOURCES, MAP_URL } from 'common/Map/const';
import OrderedLayer from 'common/Map/Layers/OrderedLayer';

interface TracksGeographicProps {
  colors: Theme;
  geomType: string;
  layerOrder?: number;
}

function LineSearchLayer(props: TracksGeographicProps) {
  const { colors, geomType, layerOrder } = props;
  const { infraID } = useSelector((state: RootState) => state.osrdconf);
  const infraVersion = infraID !== undefined ? `?infra=${infraID}` : null;

  return (
    <Source
      id={`searchTrack-${geomType}`}
      type="vector"
      url={`${MAP_URL}/layer/track_sections/mvt/${geomType}/${infraVersion}`}
      source-layer={MAP_TRACK_SOURCES.geographic}
    >
      <OrderedLayer
        source-layer={MAP_TRACK_SOURCES.geographic}
        layerOrder={layerOrder}
        id={`lineSearchLayer-${geomType}`}
        type="line"
        paint={{
          'line-color': '#ffb612',
          'line-width': 4,
        }}
        filter={['==', 'extensions_sncf_line_code', 70000]}
      />
    </Source>
  );
}

export default LineSearchLayer;
