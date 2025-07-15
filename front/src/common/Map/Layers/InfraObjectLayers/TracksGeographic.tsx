import type { Geometry } from 'geojson';
import { isNil } from 'lodash';
import { Source } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import { MAP_TRACK_SOURCES, MAP_URL } from 'common/Map/const';
import { getMap } from 'reducers/map/selectors';
import type { Theme } from 'types';

import geoMainLayer from './getGeographicLayerProps';
import { lineNameLayer, lineNumberLayer, trackNameLayer } from '../commonLayers';
import OrderedLayer from '../OrderedLayer';

interface TracksGeographicProps {
  colors: Theme;
  layerOrder?: number;
  infraID: number | undefined;
  highlightedArea?: Geometry;
}

function TracksGeographic({ colors, layerOrder, infraID, highlightedArea }: TracksGeographicProps) {
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
            'text-size': 11,
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
