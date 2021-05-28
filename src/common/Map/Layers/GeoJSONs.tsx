import React, { FC } from 'react';
import { useSelector } from 'react-redux';
import { Layer, LayerProps, Source } from 'react-map-gl';

import { geoMainLayer } from 'common/Map/Layers/geographiclayers';
// import { clippedDataSelector, EditorState } from 'reducers/editor';

const HOVERED_COLOR = '#009EED';

export const GEOJSON_LAYER_ID = 'editor/geo-main-layer';

const GeoJSONs: FC<{ colors: object; idHover?: string }> = ({ colors, idHover }) => {
  // const geoJSONs = useSelector((state: { editor: EditorState }) => {
  //   return clippedDataSelector(state.editor);
  // });

  return (
    <>
      {/*{geoJSONs.map((geoJSON, index) => (*/}
      {/*  <Source key={index} type="geojson" data={geoJSON}>*/}
      {/*    <Layer {...(geoMainLayer(colors) as LayerProps)} id={GEOJSON_LAYER_ID} />*/}
      {/*    {idHover !== undefined ? (*/}
      {/*      <Layer*/}
      {/*        type="line"*/}
      {/*        paint={{ 'line-color': HOVERED_COLOR, 'line-width': 3 }}*/}
      {/*        filter={['==', 'OP_id', idHover]}*/}
      {/*      />*/}
      {/*    ) : null}*/}
      {/*  </Source>*/}
      {/*))}*/}
    </>
  );
};

export default GeoJSONs;
