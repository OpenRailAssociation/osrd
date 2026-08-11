import type { BrokenLinking } from '../../../lib/types';
import { drawText } from '../../utils';

const BADGE_NAME_MARGIN = 8;
const BADGE_ICON_SIZE = 16;
const BADGE_GAP = 4;
const BADGE_RADIUS = 6;
const BADGE_ATTRS = {
  rest: { trainSidePadding: 16, outerPadding: 4, boxHeight: 19 },
  highlighted: { trainSidePadding: 12.5, outerPadding: 4, boxHeight: 23 },
} as const;

export const BADGE_FONT = '600 12px IBM Plex Sans';
const BADGE_REST_BACKGROUND = 'rgba(234, 167, 43, 0.3)';
const BADGE_REST_TEXT = 'rgb(125, 82, 30)';
const BADGE_HIGHLIGHTED_BACKGROUND = 'rgb(217, 28, 28)';
const BADGE_HIGHLIGHTED_TEXT = 'rgb(255, 255, 255)';

export type BadgeGeometry = {
  boxLeft: number;
  boxTop: number;
  boxWidth: number;
  boxHeight: number;
  nameX: number;
  iconX: number;
};

/**
 * The name is anchored at BADGE_NAME_MARGIN from the occupancy end, on the train
 * side, and does not move on hover. The delete icon sits on the outer side.
 * `backward` badges are mirrored: the name is on the right, the icon on the left.
 */
export const getBrokenLinkingBadgeGeometry = ({
  x,
  yCenter,
  direction,
  highlighted,
  showDelete,
  nameWidth,
}: {
  x: number;
  yCenter: number;
  direction: BrokenLinking['direction'];
  highlighted: boolean;
  showDelete: boolean;
  nameWidth: number;
}): BadgeGeometry => {
  const { trainSidePadding, outerPadding, boxHeight } =
    BADGE_ATTRS[highlighted ? 'highlighted' : 'rest'];
  const contentWidth = nameWidth + (showDelete ? BADGE_GAP + BADGE_ICON_SIZE : 0);
  const boxWidth = trainSidePadding + contentWidth + outerPadding;
  const boxTop = yCenter - boxHeight / 2;

  if (direction === 'forward') {
    const boxLeft = x + BADGE_NAME_MARGIN - trainSidePadding;
    const nameX = x + BADGE_NAME_MARGIN;
    return { boxLeft, boxTop, boxWidth, boxHeight, nameX, iconX: nameX + nameWidth + BADGE_GAP };
  }

  const boxLeft = x - BADGE_NAME_MARGIN + trainSidePadding - boxWidth;
  const iconX = boxLeft + outerPadding;
  const nameX = iconX + (showDelete ? BADGE_ICON_SIZE + BADGE_GAP : 0);
  return { boxLeft, boxTop, boxWidth, boxHeight, nameX, iconX };
};

/**
 * A broken linking is drawn as two DOM-free canvas badges (one per direction).
 * Hovering one highlights both (red), and only the hovered one shows the delete
 * icon.
 */
export const drawBrokenLinking = (
  ctx: CanvasRenderingContext2D,
  {
    x,
    yCenter,
    brokenLinking,
    highlighted,
    icon,
  }: {
    x: number;
    yCenter: number;
    brokenLinking: BrokenLinking;
    highlighted: boolean;
    icon?: HTMLImageElement;
  }
) => {
  ctx.save();
  ctx.font = BADGE_FONT;
  const nameWidth = ctx.measureText(brokenLinking.name).width;
  const { boxLeft, boxTop, boxWidth, boxHeight, nameX, iconX } = getBrokenLinkingBadgeGeometry({
    x,
    yCenter,
    direction: brokenLinking.direction,
    highlighted,
    showDelete: !!icon,
    nameWidth,
  });

  ctx.fillStyle = highlighted ? BADGE_HIGHLIGHTED_BACKGROUND : BADGE_REST_BACKGROUND;
  ctx.beginPath();
  ctx.roundRect(boxLeft, boxTop, boxWidth, boxHeight, BADGE_RADIUS);
  ctx.fill();

  drawText({
    ctx,
    text: brokenLinking.name,
    x: nameX,
    y: yCenter,
    color: highlighted ? BADGE_HIGHLIGHTED_TEXT : BADGE_REST_TEXT,
    font: BADGE_FONT,
    yPosition: 'middle',
  });

  if (icon) {
    ctx.drawImage(icon, iconX, yCenter - BADGE_ICON_SIZE / 2, BADGE_ICON_SIZE, BADGE_ICON_SIZE);
  }

  ctx.restore();
};
