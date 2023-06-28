import React, { FC, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { omit } from 'lodash';

import maplibregl from 'maplibre-gl';
import ReactMapGL, { Layer, MapRef } from 'react-map-gl';
import { BBox2d } from '@turf/helpers/dist/js/lib/geojson';
import { featureCollection } from '@turf/helpers';
import { Feature, GeoJSON } from 'geojson';

import colors from '../Consts/colors';
import { EditorSource, SourcesDefinitionsIndex } from '../Layers/GeoJSONs';
import osmBlankStyle from '../Layers/osmBlankStyle';
import { LayerType } from '../../../applications/editor/tools/types';
import { LayerContext } from '../Layers/types';
import { ALL_SIGNAL_LAYERS } from '../Consts/SignalsNames';
import { RootState } from '../../../reducers';
import { LoaderFill } from '../../Loader';

const DataDisplay: FC<{
  layers: Set<LayerType>;
  bbox: BBox2d;
  data: Partial<Record<LayerType, GeoJSON[]>> | null;
}> = ({ data, bbox, layers }) => {
  const prefix = 'warped/';
  const [map, setMap] = useState<MapRef | null>(null);
  const { mapStyle, layersSettings, showIGNBDORTHO } = useSelector((s: RootState) => s.map);

  useEffect(() => {
    if (!map) return;

    map.fitBounds(bbox, { animate: false });
  }, [map, bbox]);

  const layerContext: LayerContext = useMemo(
    () => ({
      colors: colors[mapStyle],
      signalsList: ALL_SIGNAL_LAYERS,
      symbolsList: ALL_SIGNAL_LAYERS,
      sourceLayer: 'geo',
      prefix: '',
      isEmphasized: false,
      showIGNBDORTHO,
      layersSettings,
    }),
    [colors, mapStyle, showIGNBDORTHO, layersSettings]
  );
  const sources = useMemo(
    () =>
      Array.from(layers).map((layer) => ({
        source: layer,
        id: `${prefix}geo/${layer}`,
        layers: SourcesDefinitionsIndex[layer](layerContext, prefix).map(
          (props) => omit(props, 'source-layer') as typeof props
        ),
      })),
    [layers]
  );

  return data ? (
    <ReactMapGL
      ref={setMap}
      mapLib={maplibregl}
      mapStyle={osmBlankStyle}
      style={{ width: '100%', height: '100%', background: 'white' }}
    >
      <Layer type="background" paint={{ 'background-color': 'white' }} />
      {sources.map((s) => (
        <EditorSource
          key={s.id}
          id={s.id}
          layers={s.layers}
          data={featureCollection(((data && data[s.source]) || []) as Feature[])}
        />
      ))}
    </ReactMapGL>
  ) : (
    <LoaderFill />
  );
};

export default DataDisplay;
