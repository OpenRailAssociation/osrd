import React, { FC } from 'react';
import { useSelector } from 'react-redux';
import { Layer, Source } from 'react-map-gl';
import { FeatureCollection } from 'geojson';

import { clippedPointsSelector, EditorState } from 'reducers/editor';

export const GEOJSON_POINTS_LAYER_ID = 'editor/geo-main-layer-points';

const HOVERED_COLOR = '#009EED';
const HOVERED_FILL_COLOR = '#ffffff';
const BASE_COLOR = '#0088CE';
const HOVERED_RADIUS = 4;
const BASE_RADIUS = 1;
const HOVERED_THICKNESS = 1;

const GeoJSONPoints: FC<{ idHover?: string }> = ({ idHover }) => {
  const pointsCollections = useSelector((state: { editor: EditorState }) => {
    return clippedPointsSelector(state.editor);
  });

  return (
    <>
      {pointsCollections.map((pointsCollection: FeatureCollection, index: number) => (
        <Source key={index} type="geojson" data={pointsCollection}>
          <Layer
            id={GEOJSON_POINTS_LAYER_ID}
            type="circle"
            paint={{
              'circle-radius': BASE_RADIUS,
              'circle-color': BASE_COLOR,
            }}
          />
          {idHover !== undefined ? (
            <Layer
              type="circle"
              paint={{
                'circle-radius': HOVERED_RADIUS,
                'circle-color': HOVERED_FILL_COLOR,
                'circle-stroke-color': HOVERED_COLOR,
                'circle-stroke-width': HOVERED_THICKNESS,
              }}
              filter={['==', 'pointID', idHover]}
            />
          ) : null}
        </Source>
      ))}
    </>
  );
};

export default GeoJSONPoints;
