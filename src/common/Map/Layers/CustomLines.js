import { Layer, Source } from 'react-map-gl';
import React from 'react';

import { getGeoJSONPolyline } from 'utils/helpers';
import { useSelector } from 'react-redux';

const CUSTOM_LINES_STYLE = {
  type: 'line',
  paint: {
    'line-color': '#000099',
  },
};

const CustomLines = () => {
  const { lines } = useSelector((state) => state.editor);

  return lines.length ? (
    <Source
      type="geojson"
      data={{
        type: 'FeatureCollection',
        features: lines.map((line) => getGeoJSONPolyline(line)),
      }}
    >
      <Layer {...CUSTOM_LINES_STYLE} />
    </Source>
  ) : null;
};

export default CustomLines;
