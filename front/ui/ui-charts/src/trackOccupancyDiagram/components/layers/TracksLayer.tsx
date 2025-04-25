import { useCallback } from 'react';

import { type DrawingFunction, useDraw } from '../../../spaceTimeChart';
import { drawTracks } from '../helpers/drawElements/drawTracks';
import type { Track } from '../types';

const TracksLayer = ({ tracks, position }: { tracks: Track[]; position: number }) => {
  const drawingFunction = useCallback<DrawingFunction>(
    (ctx, stcContext) => {
      drawTracks(ctx, stcContext, position, tracks);
    },
    [position, tracks]
  );

  useDraw('overlay', drawingFunction);

  return null;
};

export default TracksLayer;
