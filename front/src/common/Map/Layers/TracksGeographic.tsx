import React from 'react';
import { useSelector } from 'react-redux';
import { Source } from 'react-map-gl';

import { RootState } from 'reducers';
import { Theme } from 'types';

import { MAP_TRACK_SOURCES, MAP_URL } from 'common/Map/const';
import { geoMainLayer } from 'common/Map/Layers/geographiclayers';
import { lineNameLayer, lineNumberLayer, trackNameLayer } from 'common/Map/Layers/commonLayers';
import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import { getInfraID } from 'reducers/osrdconf/selectors';

interface TracksGeographicProps {
  colors: Theme;
  layerOrder?: number;
}

function TracksGeographic(props: TracksGeographicProps) {
  const { colors, layerOrder } = props;
  const infraID = useSelector(getInfraID);
  const { showIGNBDORTHO, showIGNSCAN25 } = useSelector((state: RootState) => state.map);
  const infraVersion = infraID !== undefined ? `?infra=${infraID}` : null;

  return (
    <Source
      id="tracksGeographic"
      type="vector"
      url={`${MAP_URL}/layer/track_sections/mvt/geo/${infraVersion}`}
      source-layer={MAP_TRACK_SOURCES.geographic}
    >
      <OrderedLayer
        {...geoMainLayer(colors, showIGNBDORTHO || showIGNSCAN25)}
        id="chartis/tracks-geo/main"
        source-layer={MAP_TRACK_SOURCES.geographic}
        layerOrder={layerOrder}
      />
      <OrderedLayer
        {...{
          ...trackNameLayer(colors),
          layout: {
            ...trackNameLayer(colors).layout,
            'text-field': '{extensions_sncf_track_name}',
            'text-size': 11,
          },
        }}
        id="chartis/tracks-geo/name"
        source-layer={MAP_TRACK_SOURCES.geographic}
        filter={['==', 'type_voie', 'VP']}
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
        id="chartis/tracks-geo/name"
        source-layer={MAP_TRACK_SOURCES.geographic}
        filter={['!=', 'type_voie', 'VP']}
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
        id="chartis/tracks-geo/number"
        source-layer={MAP_TRACK_SOURCES.geographic}
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
        source-layer={MAP_TRACK_SOURCES.geographic}
        layerOrder={layerOrder}
      />
    </Source>
  );
}

export default TracksGeographic;
