import React from 'react';
import { useSelector } from 'react-redux';
import { Layer, Source } from 'react-map-gl';
import { flatten } from 'lodash';
import bboxClip from '@turf/bbox-clip';

import { geoMainLayer } from 'common/Map/Layers/geographiclayers';

const COLLECTION_TYPE = 'FeatureCollection';
const CLIPPABLE_TYPE = 'Feature';

const HOVERED_COLOR = '#2DD1FF';

function clip(tree, bbox) {
  if (tree.type === COLLECTION_TYPE) {
    return {
      ...tree,
      features: tree.features.map((f) => clip(f, bbox)),
    };
  }

  if (tree.type === CLIPPABLE_TYPE) {
    return bboxClip(tree, bbox);
  }

  return tree;
}

const GeoJSONs = ({ colors, idHover }) => {
  const { editionZone, editionData } = useSelector((state) => state.editor);
  if (!editionData || !editionZone) return null;

  const bbox = flatten(editionZone);

  return editionData.map((geoJSON, index) => {
    const clippedGeoJSON = clip(geoJSON, bbox);
    return (
      <Source key={index} type="geojson" data={clippedGeoJSON}>
        <Layer {...geoMainLayer(colors)} id="editor/geo-main-layer" />
        {idHover !== undefined ? (
          <Layer
            type="line"
            paint={{ 'line-color': HOVERED_COLOR, 'line-width': 3 }}
            filter={['==', 'OP_id', idHover]}
          />
        ) : null}
      </Source>
    );
  });
};

export default GeoJSONs;
