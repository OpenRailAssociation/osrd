import { Layer, Source } from 'react-map-gl';
import { useSelector } from 'react-redux';
import React, { FC } from 'react';

import { EditorState } from '../../../reducers/editor';
import { zoneToFeature } from '../../../utils/mapboxHelper';
import { Zone } from '../../../types';

const EditorZone: FC<{ newZone?: Zone }> = ({ newZone }) => {
  const { editorZone } = useSelector((state: { editor: EditorState }) => state.editor);

  return (
    <>
      {editorZone ? (
        <Source type="geojson" data={zoneToFeature(editorZone, true)}>
          <Layer
            type="line"
            paint={{ 'line-color': '#333', 'line-width': 2, 'line-dasharray': [3, 3] }}
          />
        </Source>
      ) : null}
      {newZone ? (
        <Source type="geojson" data={zoneToFeature(newZone)}>
          <Layer type="line" paint={{ 'line-color': '#666', 'line-dasharray': [3, 3] }} />
        </Source>
      ) : null}
    </>
  );
};

export default EditorZone;
