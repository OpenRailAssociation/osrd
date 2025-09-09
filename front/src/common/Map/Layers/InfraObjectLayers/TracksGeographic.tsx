import type { Geometry } from 'geojson';
import { isNil } from 'lodash';
import { Source } from 'react-map-gl/maplibre';

import { MAP_TRACK_SOURCES, MAP_URL } from 'common/Map/const';
import { lineNameLayer, lineNumberLayer, trackNameLayer } from 'common/Map/Layers/commonLayers';
import type { Theme } from 'common/Map/theme';
import { useMapSettings } from 'reducers/commonMap';

import geoMainLayer from './getGeographicLayerProps';
import OrderedLayer from '../OrderedLayer';

type TracksGeographicProps = {
  colors: Theme;
  layerOrder?: number;
  infraID: number | undefined;
  highlightedArea?: Geometry;
};

function TracksGeographic({ colors, layerOrder, infraID, highlightedArea }: TracksGeographicProps) {
  const { showIGNBDORTHO, showIGNSCAN25 } = useMapSettings();

  if (isNil(infraID)) return null;
  return (
    <Source
      id="tracksGeographic"
      type="vector"
      url={`${MAP_URL}/layer/track_sections/mvt/geo/?infra=${infraID}`}
      source-layer={MAP_TRACK_SOURCES.geographic}
    >
      <OrderedLayer
        {...geoMainLayer(colors, showIGNBDORTHO || showIGNSCAN25, highlightedArea)}
        id="chartis/tracks-geo/main"
        source-layer={MAP_TRACK_SOURCES.geographic}
        layerOrder={layerOrder}
      />
      <OrderedLayer
        {...{
          ...trackNameLayer(colors, highlightedArea),
          layout: {
            ...trackNameLayer(colors, highlightedArea).layout,
            'text-field': '{extensions_sncf_track_name}',
          },
        }}
        id="chartis/tracks-geo/track-name"
        source-layer={MAP_TRACK_SOURCES.geographic}
        layerOrder={layerOrder}
      />
      <OrderedLayer
        {...{
          ...lineNumberLayer(colors, highlightedArea),
          layout: {
            ...lineNumberLayer(colors, highlightedArea).layout,
            'text-field': '{extensions_sncf_line_code}',
          },
        }}
        id="chartis/tracks-geo/line-number"
        source-layer={MAP_TRACK_SOURCES.geographic}
        layerOrder={layerOrder}
      />
      <OrderedLayer
        {...{
          ...lineNameLayer(colors, highlightedArea),
          layout: {
            ...lineNameLayer(colors, highlightedArea).layout,
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
