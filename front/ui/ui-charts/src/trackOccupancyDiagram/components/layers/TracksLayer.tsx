import { useCallback } from 'react';

import { type DrawingFunction, useDraw } from '../../../spaceTimeChart';
import { drawTracks } from '../helpers/drawElements/drawTracks';
import type { Track } from '../types';

const TracksLayer = ({
  tracks,
  position,
  topPadding,
  drawBorders,
}: {
  tracks: Track[];
  position: number;
  topPadding: number;
  drawBorders: boolean;
}) => {
  const drawingFunction = useCallback<DrawingFunction>(
    (ctx, stcContext) => {
      drawTracks(ctx, stcContext, { position, topPadding, tracks, drawBorders });
    },
    [drawBorders, position, topPadding, tracks]
  );

  useDraw('overlay', drawingFunction);

  return null;
};

export default TracksLayer;
