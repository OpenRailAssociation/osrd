import { useCallback } from 'react';

import { useDraw } from '../../../common/hooks/useCanvas';
import type { DrawingFunction } from '../../../common/types';
import {
  SpaceTimeChartCanvasContext,
  type SpaceTimeChartContextType,
} from '../../../spaceTimeChart';
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
  const drawingFunction = useCallback<DrawingFunction<SpaceTimeChartContextType>>(
    (ctx, stcContext) => {
      drawTracks(ctx, stcContext, { position, topPadding, tracks, drawBorders });
    },
    [drawBorders, position, topPadding, tracks]
  );

  useDraw(SpaceTimeChartCanvasContext, 'background', drawingFunction);

  return null;
};

export default TracksLayer;
