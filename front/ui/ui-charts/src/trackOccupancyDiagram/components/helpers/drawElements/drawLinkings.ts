import type { SpaceTimeChartContextType } from '../../../../spaceTimeChart';
import { OCCUPANCY_SEPARATOR_WIDTH, OCCUPANCY_ZONE_HEIGHT } from '../../../lib/consts';
import type { Linking, LinkingColors } from '../../../lib/types';
import { getOccupancyZonesY } from './drawOccupancyZones';

const CAPSULE_HEIGHT = 9;
const CAPSULE_RADIUS = 6;
const CAPSULE_OPACITY = 0.5;
const CAPSULE_FILL = 'rgb(255, 255, 255)';
const CAPSULE_BORDER_WIDTH = 1;
const CAPSULE_OUTLINE_WIDTH = 4;
const STRIPE_WIDTH = OCCUPANCY_ZONE_HEIGHT - OCCUPANCY_SEPARATOR_WIDTH;
const STRIPE_DASH_PATTERN = [6, 6];
const OUTLINE_OVERHANG = CAPSULE_OUTLINE_WIDTH / 2;

// The capsule fills the gap between the two occupancies, and must touch them without covering them:
// that is what the inset is for. The same path is also used to clip the stripes.
const buildCapsulePath = (x1: number, x2: number, yCenter: number, inset = 0) => {
  const path = new Path2D();
  path.roundRect(
    x1 + inset,
    yCenter - CAPSULE_HEIGHT / 2,
    Math.max(x2 - x1 - inset * 2, 0),
    CAPSULE_HEIGHT,
    CAPSULE_RADIUS
  );
  return path;
};

const drawCapsule = (
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  { base, soft }: LinkingColors
) => {
  ctx.save();
  ctx.globalAlpha = CAPSULE_OPACITY;
  ctx.strokeStyle = soft;
  ctx.lineWidth = CAPSULE_OUTLINE_WIDTH;
  ctx.stroke(path);
  ctx.fillStyle = CAPSULE_FILL;
  ctx.fill(path);
  ctx.strokeStyle = base;
  ctx.lineWidth = CAPSULE_BORDER_WIDTH;
  ctx.stroke(path);
  ctx.restore();
};

// Two overlaid lines making the striped effect from the mockup: a solid light
// one below, a dashed dark one above. The lines are clipped by the capsule
// path: a stripe reaching the border is cut there.
const drawStripes = (
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  { x1, x2, yCenter }: { x1: number; x2: number; yCenter: number },
  { line, dashes }: { line: string; dashes: string }
) => {
  ctx.save();
  ctx.clip(path);
  // do not inherit the round caps set by the occupancy zones layer
  ctx.lineCap = 'butt';
  ctx.lineWidth = STRIPE_WIDTH;
  ctx.strokeStyle = line;
  ctx.beginPath();
  ctx.moveTo(x1, yCenter);
  ctx.lineTo(x2, yCenter);
  ctx.stroke();
  ctx.strokeStyle = dashes;
  ctx.setLineDash(STRIPE_DASH_PATTERN);
  ctx.stroke();
  ctx.restore();
};

export const drawLinking = (
  ctx: CanvasRenderingContext2D,
  stcContext: SpaceTimeChartContextType,
  { linking, position, yOffset }: { linking: Linking; position: number; yOffset: number }
) => {
  const x1 = stcContext.getTimePixel(linking.startTime);
  const x2 = stcContext.getTimePixel(linking.endTime);
  const yCenter = getOccupancyZonesY(stcContext, position) + yOffset + OCCUPANCY_ZONE_HEIGHT / 2;
  const capsulePath = buildCapsulePath(x1, x2, yCenter, OUTLINE_OVERHANG);
  const bridgePath = buildCapsulePath(x1, x2, yCenter);

  const geometry = { x1, x2, yCenter };
  const { colors } = linking;
  // The stripes of the linking under the cursor take the most contrasted shades:
  const stripes = linking.hover
    ? { line: colors.surface, dashes: colors.strong }
    : { line: colors.soft, dashes: colors.base };

  // Two kinds of linking:
  //   - suggested: an empty capsule you click to create the linking
  //   - non-suggested: an existing linking, shown as stripes
  // On hover, both draw stripes inside the capsule.
  if (linking.suggested) {
    drawCapsule(ctx, capsulePath, colors);
    if (linking.hover) {
      drawStripes(ctx, capsulePath, geometry, stripes);
    }
  } else if (linking.hover) {
    drawCapsule(ctx, capsulePath, colors);
    drawStripes(ctx, capsulePath, geometry, stripes);
  } else {
    drawStripes(ctx, bridgePath, geometry, stripes);
  }
};
