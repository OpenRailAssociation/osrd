import { Layer, Source } from 'react-map-gl';
import { MAP_TRACK_SOURCES, MAP_URL } from 'common/Map/const';
import { lineNameLayer, lineNumberLayer, trackNameLayer } from 'common/Map/Layers/commonlayers';
import { schematicMainLayer, schematicServiceLayer } from 'common/Map/Layers/schematiclayers';

import PropTypes from 'prop-types';
import React from 'react';
import { useSelector } from 'react-redux';

const TracksSchematic = (props) => {
  const { colors, idHover } = props;
  const { infraID } = useSelector((state) => state.osrdconf);
  const infraVersion = infraID !== undefined ? `?infra=${infraID}` : null;
  return (
    <Source
      id="tracksSchematic"
      type="vector"
      url={`${MAP_URL}/layer/track_sections/mvt/sch/${infraVersion}`}
      source-layer={MAP_TRACK_SOURCES.schematic}
    >
      <Layer
        {...schematicServiceLayer(colors)}
        id="chartis/tracks-sch/service"
        source-layer={MAP_TRACK_SOURCES.schematic}
      />
      <Layer
        {...schematicMainLayer(colors)}
        id="chartis/tracks-sch/main"
        source-layer={MAP_TRACK_SOURCES.schematic}
      />
      <Layer
        {...{
          ...trackNameLayer(colors),
          layout: {
            ...trackNameLayer(colors).layout,
            'text-field': '{track_name}',
            'text-size': 12,
          },
        }}
        source-layer={MAP_TRACK_SOURCES.schematic}
      />
      <Layer
        {...{
          ...lineNumberLayer(colors),
          layout: {
            ...lineNumberLayer(colors).layout,
            'text-field': '{line_code}',
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
