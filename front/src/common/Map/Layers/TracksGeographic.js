import { Layer, Source } from 'react-map-gl';
import { MAP_TRACK_SOURCES, MAP_URL } from 'common/Map/const';
import { geoMainLayer, geoServiceLayer } from 'common/Map/Layers/geographiclayers.ts';
import { lineNameLayer, lineNumberLayer, trackNameLayer } from 'common/Map/Layers/commonlayers';

import PropTypes from 'prop-types';
import React from 'react';
import { useSelector } from 'react-redux';

const TracksGeographic = (props) => {
  const { colors } = props;
  const { infraID } = useSelector((state) => state.osrdconf);
  const infraVersion = infraID !== undefined ? `?infra=${infraID}` : null;

  return (
    <Source
      id="tracksGeographic"
      type="vector"
      url={`${MAP_URL}/layer/track_sections/mvt/geo/${infraVersion}`}
      source-layer={MAP_TRACK_SOURCES.geographic}
    >
      <Layer
        {...geoMainLayer(colors)}
        id="chartis/tracks-geo/main"
        source-layer={MAP_TRACK_SOURCES.geographic}
      />
      <Layer
        {...geoServiceLayer(colors)}
        id="chartis/tracks-geo/service"
        source-layer={MAP_TRACK_SOURCES.geographic}
      />
      <Layer
        {...{
          ...trackNameLayer(colors),
          layout: {
            ...trackNameLayer(colors).layout,
            'text-field': '{track_name}',
            'text-size': 11,
          },
        }}
        id="chartis/tracks-geo/name"
        source-layer={MAP_TRACK_SOURCES.geographic}
        filter={['==', 'type_voie', 'VP']}
      />
      <Layer
        {...{
          ...trackNameLayer(colors),
          layout: {
            ...trackNameLayer(colors).layout,
            'text-field': '{track_name}',
            'text-size': 10,
          },
        }}
        id="chartis/tracks-geo/name"
        source-layer={MAP_TRACK_SOURCES.geographic}
        filter={['!=', 'type_voie', 'VP']}
      />
      <Layer
        {...{
          ...lineNumberLayer(colors),
          layout: {
            ...lineNumberLayer(colors).layout,
            'text-field': '{line_code}',
          },
        }}
        id="chartis/tracks-geo/number"
        source-layer={MAP_TRACK_SOURCES.geographic}
      />
      <Layer
        {...lineNameLayer(colors)}
        source-layer={MAP_TRACK_SOURCES.geographic}
      />
    </Source>
  );
};

TracksGeographic.propTypes = {
  colors: PropTypes.object.isRequired,
};


export default TracksGeographic;
