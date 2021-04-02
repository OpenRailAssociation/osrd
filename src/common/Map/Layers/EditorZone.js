import { Layer, Source } from 'react-map-gl';
import React from 'react';

import { getGeoJSONRectangle } from 'utils/helpers';
import { useSelector } from 'react-redux';

const EDITOR_ZONE_STYLE = {
  type: 'line',
  paint: {
    'line-color': '#000000',
  },
};

const EditorZone = () => {
  const { editionZone } = useSelector((state) => state.editor);

  return editionZone ? (
    <Source type="geojson" data={getGeoJSONRectangle(...editionZone)}>
      <Layer {...EDITOR_ZONE_STYLE} />
    </Source>
  ) : null;
};

export default EditorZone;
