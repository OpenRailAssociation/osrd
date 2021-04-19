import { Layer, Source } from 'react-map-gl';
import { useSelector } from 'react-redux';
import React from 'react';

import { getSelectionGeoJSON } from 'utils/helpers';

const COLOR = '#333';

const EditorZone = () => {
  const { editionZone } = useSelector((state) => state.editor);

  return editionZone ? (
    <Source type="geojson" data={getSelectionGeoJSON(...editionZone)}>
      <Layer type="line" paint={{ 'line-color': COLOR }} />
      <Layer
        type="symbol"
        paint={{ 'text-color': COLOR }}
        layout={{
          'text-field': ['get', 'label'],
          'text-anchor': 'top-left',
          'text-font': ['Roboto Condensed'],
          'text-size': 14,
          'text-padding': 5,
        }}
      />
    </Source>
  ) : null;
};

export default EditorZone;
