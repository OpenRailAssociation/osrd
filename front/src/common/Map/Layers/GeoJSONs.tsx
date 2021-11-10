import React, { FC, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Layer, LayerProps, Source } from 'react-map-gl';
import { FeatureCollection } from 'geojson';
import { keyBy } from 'lodash';

import { geoMainLayer } from 'common/Map/Layers/geographiclayers';
import { clippedDataSelector, EditorState } from 'reducers/editor';
import { Item, Theme } from '../../../types';

const HOVERED_COLOR = '#009EED';
const SELECTED_COLOR = '#0c6b9a';

export const GEOJSON_LAYER_ID = 'editor/geo-main-layer';

const GeoJSONs: FC<{ colors: Theme; hoveredIDs?: Item[]; selectionIDs?: Item[] }> = ({
  colors,
  hoveredIDs,
  selectionIDs,
}) => {
  const geoJSONs = useSelector((state: { editor: EditorState }) =>
    clippedDataSelector(state.editor)
  );

  const qualifiedGeoJSONs = useMemo(() => {
    const hovered = keyBy(hoveredIDs || [], 'id');
    const selection = keyBy(selectionIDs || [], 'id');

    return geoJSONs.map((geoJSON) => ({
      ...geoJSON,
      features: geoJSON.features.map((feature) => ({
        ...feature,
        properties: {
          ...feature.properties,
          ...(selection[feature.properties?.OP_id] ? { selected: true } : {}),
          ...(hovered[feature.properties?.OP_id] ? { hovered: true } : {}),
        },
      })),
    }));
  }, [geoJSONs, hoveredIDs, selectionIDs]);

  return (
    <>
      {qualifiedGeoJSONs.map((geoJSON, index) => (
        <Source key={index} type="geojson" data={geoJSON as FeatureCollection}>
          <Layer {...(geoMainLayer(colors) as LayerProps)} id={GEOJSON_LAYER_ID} />
          <Layer
            type="line"
            paint={{ 'line-color': HOVERED_COLOR, 'line-width': 3 }}
            filter={['==', 'hovered', true]}
          />
          <Layer
            type="line"
            paint={{ 'line-color': SELECTED_COLOR, 'line-width': 3 }}
            filter={['==', 'selected', true]}
          />
        </Source>
      ))}
    </>
  );
};

export default GeoJSONs;
