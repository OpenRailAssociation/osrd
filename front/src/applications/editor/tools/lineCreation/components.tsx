import React, { FC, useContext } from 'react';
import { useSelector } from 'react-redux';
import { Layer, Source } from 'react-map-gl';

import { EditorContext, EditorContextType } from '../../context';
import GeoJSONs from '../../../../common/Map/Layers/GeoJSONs';
import colors from '../../../../common/Map/Consts/colors';
import EditorZone from '../../../../common/Map/Layers/EditorZone';
import { LineCreationState } from './types';

export const LineCreationLayers: FC = () => {
  const { state } = useContext(EditorContext) as EditorContextType<LineCreationState>;
  const { mapStyle } = useSelector((s: { map: any }) => s.map) as { mapStyle: string };
  const lastPosition: [number, number] =
    state.anchorLinePoints && state.nearestPoint
      ? (state.nearestPoint.geometry.coordinates as [number, number])
      : state.mousePosition;

  return (
    <>
      <EditorZone
        newZone={
          state.linePoints.length
            ? { type: 'polygon', points: state.linePoints.concat([lastPosition]) }
            : undefined
        }
      />
      <GeoJSONs colors={colors[mapStyle]} />

      {state.nearestPoint && (
        <Source type="geojson" data={state.nearestPoint}>
          <Layer
            type="circle"
            paint={{
              'circle-radius': 4,
              'circle-color': '#ffffff',
              'circle-stroke-color': '#009EED',
              'circle-stroke-width': 1,
            }}
          />
        </Source>
      )}
    </>
  );
};
