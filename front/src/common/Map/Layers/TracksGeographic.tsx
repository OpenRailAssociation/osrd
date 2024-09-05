import { isNil } from 'lodash';
import { Source } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import { MAP_TRACK_SOURCES, MAP_URL } from 'common/Map/const';
import { lineNameLayer, lineNumberLayer, trackNameLayer } from 'common/Map/Layers/commonLayers';
import geoMainLayer from 'common/Map/Layers/geographiclayers';
import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import { getMap } from 'reducers/map/selectors';
import type { Theme } from 'types';

interface TracksGeographicProps {
  colors: Theme;
  layerOrder?: number;
  infraID: number | undefined;
}

function TracksGeographic({ colors, layerOrder, infraID }: TracksGeographicProps) {
  const { showIGNBDORTHO, showIGNSCAN25 } = useSelector(getMap);

  if (isNil(infraID)) return null;
  return (
    <Source
      id="tracksGeographic"
      type="vector"
      url={`${MAP_URL}/layer/track_sections/mvt/geo/?infra=${infraID}`}
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
        id="chartis/tracks-geo/track-name"
        source-layer={MAP_TRACK_SOURCES.geographic}
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
        id="chartis/tracks-geo/line-number"
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
        id="chartis/tracks-geo/line-name"
        source-layer={MAP_TRACK_SOURCES.geographic}
        layerOrder={layerOrder}
      />
    </Source>
  );
}

export default TracksGeographic;
