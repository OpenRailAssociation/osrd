import { useCallback } from 'react';

import { TimeChartCanvasContext } from '../../../common/context';
import { useDraw } from '../../../common/hooks/useCanvas';
import type { DrawingFunction, TimeChartContextType } from '../../../common/types';
import type { Track } from '../../lib/types';
import { drawTracks } from '../helpers/drawElements/drawTracks';

const TracksLayer = ({
  tracks,
  top,
  height,
  topPadding,
  drawBorders,
  highlightedTrackId,
  showTicks,
}: {
  tracks: Track[];
  top: number;
  height: number;
  topPadding: number;
  drawBorders: boolean;
  highlightedTrackId?: string;
  showTicks?: boolean;
}) => {
  const drawingFunction = useCallback<DrawingFunction<TimeChartContextType>>(
    (ctx, tcContext) => {
      drawTracks(ctx, tcContext, {
        top,
        height,
        topPadding,
        tracks,
        drawBorders,
        highlightedTrackId,
        showTicks,
      });
    },
    [drawBorders, top, height, topPadding, tracks, highlightedTrackId, showTicks]
  );

  useDraw(TimeChartCanvasContext, 'background', drawingFunction);

  return null;
};

export default TracksLayer;
