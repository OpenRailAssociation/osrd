import React, { FC, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Layer, LayerProps, Source } from 'react-map-gl';
import { keyBy } from 'lodash';
import { FeatureCollection } from 'geojson';

import { Item, Theme } from '../../../types';
import { clippedDataSelector, EditorState } from '../../../reducers/editor';
import { geoMainLayer } from './geographiclayers';

const HOVERED_COLOR = '#009EED';
const SELECTED_COLOR = '#0c6b9a';

export const GEOJSON_LAYER_ID = 'editor/geo-main-layer';

const GeoJSONs: FC<{ colors: Theme; hoveredIDs?: Item[]; selectionIDs?: Item[] }> = ({
  colors,
  hoveredIDs,
  selectionIDs,
}) => {
  const editorData = useSelector((state: { editor: EditorState }) =>
    clippedDataSelector(state.editor)
  );

  const geojson = useMemo(() => {
    const hovered = keyBy(hoveredIDs || [], 'id');
    const selection = keyBy(selectionIDs || [], 'id');
    return {
      type: 'FeatureCollection',
      features: editorData.map((feature) => ({
        ...feature,
        properties: {
          ...feature.properties,
          ...(selection[feature.properties?.id] ? { selected: true } : {}),
          ...(hovered[feature.properties?.id] ? { hovered: true } : {}),
        },
      })),
    } as FeatureCollection;
  }, [editorData, hoveredIDs, selectionIDs]);

  return (
    <Source type="geojson" data={geojson}>
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
  );
};

export default GeoJSONs;
