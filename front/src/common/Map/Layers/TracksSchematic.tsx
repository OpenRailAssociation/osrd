import React from 'react';
import { useSelector } from 'react-redux';
import { Source } from 'react-map-gl';

import { MAP_TRACK_SOURCES, MAP_URL } from 'common/Map/const';
import { lineNameLayer, lineNumberLayer, trackNameLayer } from 'common/Map/Layers/commonLayers';
import { schematicMainLayer } from 'common/Map/Layers/schematiclayers';
import { Theme } from 'types';
import { RootState } from 'reducers';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import { getInfraID } from 'reducers/osrdconf/selectors';

interface TracksSchematicProps {
  colors: Theme;
  idHover?: string;
  layerOrder?: number;
}

function TracksSchematic(props: TracksSchematicProps) {
  const { colors, idHover, layerOrder } = props;
  const infraID = useSelector(getInfraID);
  const infraVersion = infraID !== undefined ? `?infra=${infraID}` : null;
  return (
    <Source
      id="tracksSchematic"
      type="vector"
      url={`${MAP_URL}/layer/track_sections/mvt/sch/${infraVersion}`}
      source-layer={MAP_TRACK_SOURCES.schematic}
    >
      <OrderedLayer
        {...schematicMainLayer(colors)}
        id="chartis/tracks-sch/main"
        source-layer={MAP_TRACK_SOURCES.schematic}
        layerOrder={layerOrder}
      />
      <OrderedLayer
        {...{
          ...trackNameLayer(colors),
          layout: {
            ...trackNameLayer(colors).layout,
            'text-field': '{extensions_sncf_track_name}',
            'text-size': 10,
          },
        }}
        source-layer={MAP_TRACK_SOURCES.schematic}
        layerOrder={layerOrder}
      />
      <OrderedLayer
        {...{
          ...lineNumberLayer(colors),
          layout: {
            ...lineNumberLayer(colors).layout,
            'text-field': '{extensions_sncf_line_code}',
          },
        }}
        source-layer={MAP_TRACK_SOURCES.schematic}
        layerOrder={layerOrder}
      />
      <OrderedLayer
        {...{
          ...lineNameLayer(colors),
          layout: {
            ...lineNameLayer(colors).layout,
            'text-field': '{extensions_sncf_line_name}',
          },
        }}
        source-layer={MAP_TRACK_SOURCES.schematic}
        layerOrder={layerOrder}
      />

      {idHover !== undefined ? (
        <OrderedLayer
          type="line"
          paint={{ 'line-color': '#ffb612', 'line-width': 3 }}
          filter={['==', 'OP_id', idHover]}
          source-layer={MAP_TRACK_SOURCES.schematic}
          layerOrder={layerOrder}
        />
      ) : null}
    </Source>
  );
}

export default TracksSchematic;
