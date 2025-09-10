import { useCallback } from 'react';

import type { DrawingFunction } from '../../../common/types';
import { useDraw } from '../../../common/useCanvas';
import type { Track } from '../../lib/types';
import { drawTracks } from '../helpers/drawElements/drawTracks';

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
