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

const GeoJSONs: FC<{ colors: Theme; hidden?: Item[]; hovered?: Item[]; selection?: Item[] }> = ({
  colors,
  hidden,
  hovered,
  selection,
}) => {
  const editorData = useSelector((state: { editor: EditorState }) =>
    clippedDataSelector(state.editor)
  );

  const geojson = useMemo(() => {
    const hiddenIndex = keyBy(hidden || [], 'id');
    const hoveredIndex = keyBy(hovered || [], 'id');
    const selectionIndex = keyBy(selection || [], 'id');
    return {
      type: 'FeatureCollection',
      features: editorData.map((feature) => ({
        ...feature,
        properties: {
          ...feature.properties,
          ...(selectionIndex[feature.properties?.id] ? { selected: true } : {}),
          ...(hoveredIndex[feature.properties?.id] ? { hovered: true } : {}),
          ...(hiddenIndex[feature.properties?.id] ? { hidden: true } : {}),
        },
      })),
    } as FeatureCollection;
  }, [editorData, hidden, hovered, selection]);

  return (
    <Source type="geojson" data={geojson}>
      <Layer
        {...(geoMainLayer(colors) as LayerProps)}
        id={GEOJSON_LAYER_ID}
        filter={['!=', 'hidden', true]}
      />
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
