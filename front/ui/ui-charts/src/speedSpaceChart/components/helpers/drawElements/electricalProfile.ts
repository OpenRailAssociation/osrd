import type { DrawFunctionParams } from '../../../types';
import { LINEAR_LAYERS_BACKGROUND_COLOR, LINEAR_LAYERS_HEIGHTS, MARGINS } from '../../const';
import {
  clearCanvas,
  drawLinearLayerBackground,
  drawSeparatorLinearLayer,
  maxPositionValue,
  positionOnGraphScale,
} from '../../utils';

const PROFILE_HEIGHT_MAX = 40;
const MARGIN_POSITION_TEXT = 12;
const SELECTION_BAR_HEIGHT_AJUSTEMENT = 30;

const maxHeightLevel = (heightLevel: number) => (heightLevel > 7 ? 7 : heightLevel);

export const drawElectricalProfile = ({ ctx, width, height, store }: DrawFunctionParams) => {
  const { electricalProfiles, ratioX, leftOffset, cursor } = store;
  const { ELECTRICAL_PROFILES_HEIGHT } = LINEAR_LAYERS_HEIGHTS;

  if (!electricalProfiles) return;
  clearCanvas(ctx, width, height);

  const topLayer = height - ELECTRICAL_PROFILES_HEIGHT;

  ctx.save();
  ctx.translate(leftOffset, 0);
  const maxPosition = maxPositionValue(store.speeds);
  const {
    MARGIN_TOP,
    MARGIN_BOTTOM,
    MARGIN_LEFT,
    MARGIN_RIGHT,
    CURVE_MARGIN_SIDES,
    ELECTRICAL_PROFILES_MARGIN_TOP,
  } = MARGINS;

  drawLinearLayerBackground(
    ctx,
    LINEAR_LAYERS_BACKGROUND_COLOR.FIRST,
    MARGINS,
    width,
    topLayer,
    ELECTRICAL_PROFILES_HEIGHT
  );

  electricalProfiles.forEach((data) => {
    const xStart = positionOnGraphScale(data.position.start, maxPosition, width, ratioX, MARGINS);

    const xEnd = positionOnGraphScale(data.position.end!, maxPosition, width, ratioX, MARGINS);

    let topRect = topLayer - MARGIN_BOTTOM + ELECTRICAL_PROFILES_MARGIN_TOP;

    const profileWidth = xEnd - xStart;

    if (data.value.electricalProfile === 'neutral') {
      ctx.fillStyle = '#1F1B17';
      ctx.fillRect(xStart, topRect + 28, profileWidth, 9);
      ctx.clearRect(xStart, topRect + 31, profileWidth, 3);
    } else {
      const { start, end } = data.position;
      const { electricalProfile, color, heightLevel } = data.value;
      const heightLevelMax = maxHeightLevel(heightLevel!);
      ctx.fillStyle = color!;

      if (electricalProfile === 'incompatible') {
        // Incompatible profile
        for (let i = 0; i < 9; i++) {
          ctx.fillRect(xStart, topRect + 15 + i * 3, profileWidth, 1);
        }
      } else {
        topRect += heightLevelMax * 4;

        const profileHeight = PROFILE_HEIGHT_MAX - heightLevelMax * 4;

        ctx.fillRect(xStart, topRect, profileWidth, profileHeight);

        // Draw only if cursor hover a profile
        if (
          cursor.y &&
          cursor.x &&
          cursor.y <= topLayer - MARGIN_BOTTOM + MARGIN_TOP &&
          cursor.y >= topLayer - MARGIN_BOTTOM + MARGIN_TOP - ELECTRICAL_PROFILES_HEIGHT &&
          cursor.x - leftOffset >= xStart - MARGIN_LEFT &&
          cursor.x - leftOffset <= xStart + profileWidth - MARGIN_LEFT
        ) {
          // Draw selection bar
          ctx.globalAlpha = 0.2;
          ctx.fillRect(
            xStart,
            MARGIN_TOP,
            profileWidth,
            topLayer - SELECTION_BAR_HEIGHT_AJUSTEMENT
          );
          ctx.globalAlpha = 1;

          const profileNameWidth = Math.floor(ctx.measureText(electricalProfile).width);
          const marginProfileName = 20;

          const profileNameOverflow = Math.max(
            profileNameWidth + marginProfileName - profileWidth,
            0
          );

          // Draw profile name

          ctx.fillStyle = '#000';
          ctx.font = '600 14px IBM Plex Sans';
          ctx.textAlign = 'center';
          ctx.fillText(`${electricalProfile}`, xStart + profileWidth / 2, topLayer / 2);

          // Draw begin and end position
          ctx.fillStyle = 'rgb(49, 46, 43)';
          ctx.font = '400 14px IBM Plex Sans';

          ctx.textAlign = 'right';
          ctx.fillText(
            `${(start || 0).toFixed(1)}`,
            xStart - (MARGIN_POSITION_TEXT + profileNameOverflow / 2),
            topLayer / 2
          );

          ctx.textAlign = 'left';
          ctx.fillText(
            `${end!.toFixed(1)}`,
            xStart + profileWidth + (MARGIN_POSITION_TEXT + profileNameOverflow / 2),
            topLayer / 2
          );
        }
      }
    }
  });

  // Draw stroke around the selected profile
  const currentBoundaryProfileIndex = electricalProfiles.findIndex(
    ({ position }) =>
      cursor.x! - leftOffset <=
      positionOnGraphScale(position.end!, maxPosition, width, ratioX, MARGINS) - MARGIN_LEFT
  );

  if (
    cursor.y &&
    cursor.y <= topLayer - MARGIN_BOTTOM + MARGIN_TOP &&
    cursor.y >= topLayer - MARGIN_BOTTOM + MARGIN_TOP - ELECTRICAL_PROFILES_HEIGHT &&
    currentBoundaryProfileIndex !== -1
  ) {
    const { start, end } = electricalProfiles[currentBoundaryProfileIndex].position;

    const { electricalProfile, heightLevel } =
      electricalProfiles[currentBoundaryProfileIndex].value;

    if (electricalProfile && electricalProfile !== 'incompatible') {
      const heightLevelMax = maxHeightLevel(heightLevel!);
      const startHoverStrokeHeight =
        topLayer - MARGIN_BOTTOM + ELECTRICAL_PROFILES_MARGIN_TOP + heightLevelMax * 4;

      const xStart =
        positionOnGraphScale(start, maxPosition, width, ratioX, MARGINS) ||
        MARGIN_LEFT + CURVE_MARGIN_SIDES / 2;

      const xEnd =
        positionOnGraphScale(end!, maxPosition, width, ratioX, MARGINS) ||
        width - MARGIN_RIGHT - CURVE_MARGIN_SIDES / 2;

      const profileWidth = xEnd - xStart;
      const profileHeight = PROFILE_HEIGHT_MAX - heightLevelMax * 4;

      ctx.shadowColor = 'rgba(0, 0, 0, 0.19)';
      ctx.shadowBlur = 5;

      ctx.strokeStyle = '#FFF';
      ctx.lineWidth = 2;
      ctx.strokeRect(xStart - 1, startHoverStrokeHeight - 1, profileWidth + 2, profileHeight + 2);
      ctx.stroke();
    }
  }

  drawSeparatorLinearLayer(ctx, 'rgba(0,0,0,0.1)', MARGINS, width, topLayer + 1 - MARGIN_BOTTOM);

  ctx.restore();

  // Prevent overlapping with margins left and right
  ctx.clearRect(0, 0, MARGIN_LEFT, height);
  ctx.clearRect(width - MARGIN_RIGHT, 0, MARGIN_RIGHT, height);
};
