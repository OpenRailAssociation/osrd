import { useCallback, useContext } from 'react';

import { useDraw } from '../../../common/hooks/useCanvas';
import type { DrawingFunction } from '../../../common/types';
import {
  SpaceTimeChartCanvasContext,
  type SpaceTimeChartContextType,
} from '../../../spaceTimeChart';
import { MouseContext } from '../../../spaceTimeChart/lib/context';
import { COLORS } from '../../lib/consts';
import type { OccupancyZone } from '../../lib/types';
import { drawThroughTrain } from '../helpers/drawElements/drawOccupancyZones';

const DraggingOccupancyZonesLayer = ({ occupancyZones }: { occupancyZones: OccupancyZone[] }) => {
  const mouseContext = useContext(MouseContext);

  const draw = useCallback<DrawingFunction<SpaceTimeChartContextType>>(
    (ctx, { getTimePixel, height: viewportHeight }) => {
      for (const zone of occupancyZones) {
        const xStart = getTimePixel(zone.startTime);
        const xEnd = getTimePixel(zone.endTime);

        if (zone.startTime === zone.endTime) {
          drawThroughTrain(ctx, xStart, mouseContext.position.y);
        } else {
          const height = 5;
          const radius = 2;
          const rectY = mouseContext.position.y - height / 2;
          ctx.beginPath();
          ctx.roundRect(xStart, rectY, xEnd - xStart, height, radius);
        }

        // Draw zone box
        ctx.save();
        ctx.fillStyle = COLORS.PRIMARY_80;
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 5;
        ctx.shadowColor = 'rgba(60, 138, 255, 0.55)';
        ctx.fill();
        ctx.restore();

        // Draw shadow under the zone box
        ctx.save();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgb(105, 255, 254)';
        ctx.stroke();
        ctx.restore();

        // Draw two vertical dashed lines around the zone box
        ctx.save();
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.strokeStyle = COLORS.PRIMARY_50;
        ctx.setLineDash([0, 4]);
        const verticalLineSpacing = zone.startTime === zone.endTime ? 7 : 2.5;
        ctx.beginPath();
        ctx.moveTo(xStart - verticalLineSpacing, 0);
        ctx.lineTo(xStart - verticalLineSpacing, viewportHeight);
        ctx.moveTo(xEnd + verticalLineSpacing, 0);
        ctx.lineTo(xEnd + verticalLineSpacing, viewportHeight);
        ctx.stroke();
        ctx.restore();
      }
    },
    [occupancyZones, mouseContext.position.y]
  );

  useDraw(SpaceTimeChartCanvasContext, 'overlay', draw);

  return null;
};

export default DraggingOccupancyZonesLayer;
