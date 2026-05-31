import type { CurveOutline, CurveStyle } from '@osrd-project/ui-charts';

import {
  DRAGGED_CURVE_COLOR,
  DRAGGED_CURVE_OUTLINE_COLOR,
  REST_BACKGROUND_COLOR,
  SELECTED_CURVE_COLOR,
  SELECTED_CURVE_OUTLINE_COLOR,
} from 'applications/operationalStudies/consts';
import type { CategoryColors } from 'applications/operationalStudies/types';
import type { CurveVisualState } from 'modules/simulationResult/types';

export const INVALID_OUTLINE: CurveOutline = {
  offset: 4,
  color: 'transparent',
  backgroundColor: 'rgba(0, 0, 0, 0.05)',
};

const FONT_WEIGHT_REGULAR = 400;
const FONT_WEIGHT_BOLD = 600;
const RESTING_LABEL_BACKGROUND: NonNullable<CurveStyle['label']>['background'] = {
  color: REST_BACKGROUND_COLOR,
  opacity: 0.9,
};

type TrainForStyle = {
  colors: CategoryColors;
  isSimulated?: boolean;
};

const getCurveStyle = (state: CurveVisualState, train: TrainForStyle): CurveStyle => {
  const { colors, isSimulated } = train;

  const noneStyle: CurveStyle = {
    color: colors.normal,
    opacity: 1,
    label: {
      color: colors.normal,
      fontWeight: FONT_WEIGHT_REGULAR,
      background: RESTING_LABEL_BACKGROUND,
    },
    ...(isSimulated === false && { outline: INVALID_OUTLINE }),
  };

  // Active selection on the chart that received the click: blue curve and halo.
  const activeStyle: CurveStyle = {
    color: SELECTED_CURVE_COLOR,
    opacity: 1,
    outline:
      isSimulated === true
        ? { offset: 0, width: 3, color: SELECTED_CURVE_OUTLINE_COLOR }
        : INVALID_OUTLINE,
    label: {
      color: colors.hovered,
      background: { color: colors.background, border: colors.normal },
      fontWeight: FONT_WEIGHT_BOLD,
    },
  };

  const passiveSecondaryStyle: CurveStyle = {
    color: colors.normal,
    opacity: 1,
    outline:
      isSimulated === true ? { offset: 0, width: 2, color: colors.background } : INVALID_OUTLINE,
    label: {
      color: colors.hovered,
      background: { color: colors.background, border: colors.normal },
      fontWeight: FONT_WEIGHT_REGULAR,
    },
  };

  const dragStyle: CurveStyle = {
    color: DRAGGED_CURVE_COLOR,
    opacity: 1,
    level: 1,
    outline: { offset: 0, width: 1.5, color: DRAGGED_CURVE_OUTLINE_COLOR },
    label: {
      color: colors.normal,
      background: { color: colors.background },
      fontWeight: FONT_WEIGHT_BOLD,
    },
  };

  switch (state) {
    case 'none':
      return noneStyle;
    case 'active':
      return activeStyle;
    case 'passiveSecondary':
      return passiveSecondaryStyle;
    case 'drag':
      return dragStyle;
    default:
      // Other states are implemented in following commits.
      return { color: colors.normal, opacity: 1 };
  }
};

export default getCurveStyle;
