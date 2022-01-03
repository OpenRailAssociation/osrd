import React from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { Source, Layer } from 'react-map-gl';
import { geoMainLayer, geoServiceLayer } from 'common/Map/Layers/geographiclayers.ts';
import { trackNameLayer, lineNumberLayer, lineNameLayer } from 'common/Map/Layers/commonlayers';
import { MAP_TRACK_SOURCES, MAP_URL } from 'common/Map/const';

const TracksGeographic = (props) => {
  const { colors } = props;
  const { infraID } = useSelector((state) => state.osrdconf);
  const infraVersion = infraID !== undefined ? `?version=${infraID}` : null;

  return (
    <Source
      id="tracksGeographic"
      type="vector"
      // url={`${MAP_URL}/chartis/layer/map_midi_tronconditinerairevoie/mvt/geo/`}
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
            'text-field': '{V_nom}',
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
            'text-field': '{V_nom}',
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
            'text-field': '{L_code}',
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
