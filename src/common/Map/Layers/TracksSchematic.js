import React from 'react';
import PropTypes from 'prop-types';
import { Source, Layer } from 'react-map-gl';
import { schematicMainLayer, schematicServiceLayer } from 'common/Map/Layers/schematiclayers';
import { trackNameLayer, lineNumberLayer, lineNameLayer } from 'common/Map/Layers/commonlayers';
import { MAP_TRACK_SOURCES, MAP_URL } from 'common/Map/const';

const TracksSchematic = (props) => {
  const { colors, idHover } = props;
  return (
    <Source type="vector" url={`${MAP_URL}/layer/map_midi_tronconditinerairevoie/mvt/sch/`} source-layer={MAP_TRACK_SOURCES.schematic}>
      <Layer
        {...schematicServiceLayer(colors)}
        source-layer={MAP_TRACK_SOURCES.schematic}
      />
      <Layer
        {...schematicMainLayer(colors)}
        source-layer={MAP_TRACK_SOURCES.schematic}
      />
      <Layer
        {...{
          ...trackNameLayer(colors),
          layout: {
            ...trackNameLayer(colors).layout,
            'text-field': '{V_nom}',
            'text-size': 12,
          },
        }}
        source-layer={MAP_TRACK_SOURCES.schematic}
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
        source-layer={MAP_TRACK_SOURCES.schematic}
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
        source-layer={MAP_TRACK_SOURCES.schematic}
      />
      <Layer
        {...lineNameLayer(colors)}
        source-layer={MAP_TRACK_SOURCES.schematic}
      />

      {idHover !== undefined ? (
        <Layer
          type="line"
          paint={{ 'line-color': '#ffb612', 'line-width': 3 }}
          filter={['==', 'OP_id', idHover]}
          source-layer={MAP_TRACK_SOURCES.schematic}
        />
      ) : null}
    </Source>
  );
};

TracksSchematic.propTypes = {
  idHover: PropTypes.string,
  colors: PropTypes.object.isRequired,
};

TracksSchematic.defaultProps = {
  idHover: undefined,
};

export default TracksSchematic;
