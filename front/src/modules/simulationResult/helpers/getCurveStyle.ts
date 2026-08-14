import type { CurveOutline, CurveStyle } from '@osrd-project/ui-charts';

import {
  DRAGGED_CURVE_COLOR,
  DRAGGED_CURVE_OUTLINE_COLOR,
  REST_BACKGROUND_COLOR,
  SELECTED_CURVE_COLOR,
  SELECTED_CURVE_OUTLINE_COLOR,
  SELECTED_CURVE_SOFT_COLOR,
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
const OUT_OF_SELECTION_OPACITY = 0.6;
const OUT_OF_DRAG_OPACITY = 0.6;
const STOP_OPACITY_SELECTED = 0.4;
const STOP_OPACITY_PASSIVE = 0.7;
const STOP_OPACITY_HOVERED = 0.5;
const TOD_SELECTED_BAR_HEIGHT = 4;
const TOD_HALO_THICKNESS = 4;
const TOD_HALO_OPACITY = 0.25;
const RESTING_LABEL_BACKGROUND: NonNullable<CurveStyle['label']>['background'] = {
  color: REST_BACKGROUND_COLOR,
  opacity: 0.9,
};

type TrainForStyle = {
  colors: CategoryColors;
  isSimulated?: boolean;
};

type StyleOptions = {
  /**
   * Active selection is open and the train is not part of it. The curve and
   * its label fade out so the selection stands out.
   */
  outOfSelection?: boolean;
  /**
   * A drag is in progress and the train is not part of the dragged paced
   * train. The curve softens to 0.6 to put the focus on the dragged group,
   * while the label keeps its full opacity.
   */
  outOfDrag?: boolean;
  /**
   * The train is directly under the cursor. Hover takes priority over
   * `outOfSelection` (the curve "comes back" while hovered).
   */
  hovered?: boolean;
  /**
   * The curve belongs to the paced train being dragged (whether it moves or
   * is pinned by a start_time exception). Its stop indicators are hidden
   * until mouse up.
   */
  hideStops?: boolean;
  /** tod switches to the TOD specific look. std (default) the space-time chart one. */
  chart?: 'std' | 'tod';
};

const hoveredLabel = (colors: CategoryColors): NonNullable<CurveStyle['label']> => ({
  color: colors.strong,
  background: { color: colors.surface },
  fontWeight: FONT_WEIGHT_REGULAR,
});

const getBaseStyle = (state: CurveVisualState, train: TrainForStyle): CurveStyle => {
  const { colors, isSimulated } = train;

  const noneStyle: CurveStyle = {
    color: colors.base,
    opacity: 1,
    label: {
      color: colors.base,
      fontWeight: FONT_WEIGHT_REGULAR,
      background: RESTING_LABEL_BACKGROUND,
    },
    ...(isSimulated === false && { outline: INVALID_OUTLINE }),
  };

  // Active selection on the chart that received the click: blue curve and halo.
  const activeStyle: CurveStyle = {
    color: SELECTED_CURVE_COLOR,
    opacity: 1,
    stop: { thickness: 6, opacity: STOP_OPACITY_SELECTED },
    outline:
      isSimulated === true
        ? { offset: 0, width: 3, color: SELECTED_CURVE_OUTLINE_COLOR }
        : INVALID_OUTLINE,
    label: {
      color: colors.strong,
      background: { color: colors.surface, border: colors.base },
      fontWeight: FONT_WEIGHT_BOLD,
    },
  };

  // Passive primary: the curve belongs to the active selection but the click
  // happened elsewhere (mirror chart, or timetable). It keeps the category
  // color so it doesn't take the spotlight away from the actual click target.
  const passivePrimaryStyle: CurveStyle = {
    color: colors.base,
    opacity: 1,
    stop: { opacity: STOP_OPACITY_PASSIVE },
    outline:
      isSimulated === true ? { offset: 0, width: 3, color: colors.surface } : INVALID_OUTLINE,
    label: {
      color: colors.strong,
      background: { color: colors.surface, border: colors.base },
      fontWeight: FONT_WEIGHT_BOLD,
    },
  };

  const passiveSecondaryStyle: CurveStyle = {
    color: colors.base,
    opacity: 1,
    stop: { opacity: STOP_OPACITY_PASSIVE },
    outline:
      isSimulated === true ? { offset: 0, width: 2, color: colors.surface } : INVALID_OUTLINE,
    label: {
      color: colors.strong,
      background: { color: colors.surface, border: colors.base },
      fontWeight: FONT_WEIGHT_REGULAR,
    },
  };

  const dragStyle: CurveStyle = {
    color: DRAGGED_CURVE_COLOR,
    opacity: 1,
    outline: { offset: 0, width: 1.5, color: DRAGGED_CURVE_OUTLINE_COLOR },
    label: {
      color: colors.base,
      background: { color: colors.surface },
      fontWeight: FONT_WEIGHT_BOLD,
    },
  };

  switch (state) {
    case 'none':
      return noneStyle;
    case 'active':
      return activeStyle;
    case 'passivePrimary':
      return passivePrimaryStyle;
    case 'passiveSecondary':
      return passiveSecondaryStyle;
    case 'drag':
      return dragStyle;
    default: {
      // Exhaustiveness check: TS fails to compile if a state is added to the
      // union without a case here.
      // https://www.typescriptlang.org/docs/handbook/2/narrowing.html#exhaustiveness-checking
      const _exhaustive: never = state;
      throw new Error(`Unhandled curve visual state: ${_exhaustive}`);
    }
  }
};

const getHoveredStyle = (state: CurveVisualState, train: TrainForStyle): CurveStyle => {
  const { colors, isSimulated } = train;
  // Hovered curves switch to the category hovered tint, per the spec. The
  // active one is the exception: it has no dedicated hover look, only its
  // label switches to the hovered one.
  if (state === 'active')
    return {
      ...getBaseStyle(state, train),
      label: hoveredLabel(colors),
      stop: { thickness: 6, opacity: STOP_OPACITY_HOVERED },
    };
  if (state === 'none' || state === 'passivePrimary' || state === 'passiveSecondary') {
    return {
      color: colors.strong,
      opacity: 1,
      level: 3,
      label: hoveredLabel(colors),
      stop: { opacity: STOP_OPACITY_HOVERED, color: colors.base },
      ...(isSimulated === false && { outline: INVALID_OUTLINE }),
    };
  }

  // 'drag' does not change on hover: the user is already interacting with
  // this curve.
  return getBaseStyle(state, train);
};

const getTodStyle = (
  state: CurveVisualState,
  train: TrainForStyle,
  hovered: boolean
): CurveStyle => {
  const { colors } = train;

  // Primary selection (active, blue) keeps its appearance on hover; every other
  // state switches to the hovered look.
  if (hovered && state !== 'active') {
    return {
      color: colors.strong,
      opacity: 1,
      border: { color: colors.soft, width: 1 },
      label: hoveredLabel(colors),
    };
  }

  switch (state) {
    case 'none':
      return {
        color: colors.base,
        opacity: 1,
        label: { color: colors.base, fontWeight: FONT_WEIGHT_REGULAR },
      };
    case 'active':
      return {
        color: SELECTED_CURVE_COLOR,
        opacity: 1,
        thickness: TOD_SELECTED_BAR_HEIGHT,
        outline: {
          offset: 0,
          width: TOD_HALO_THICKNESS,
          color: SELECTED_CURVE_SOFT_COLOR,
          opacity: TOD_HALO_OPACITY,
        },
        label: {
          color: colors.strong,
          background: { color: colors.surface, border: colors.base },
          fontWeight: FONT_WEIGHT_BOLD,
        },
      };
    case 'passivePrimary':
      return {
        color: colors.base,
        opacity: 1,
        outline: {
          offset: 0,
          width: TOD_HALO_THICKNESS,
          color: colors.soft,
          opacity: TOD_HALO_OPACITY,
        },
        label: {
          color: colors.strong,
          background: { color: colors.surface, border: colors.base },
          fontWeight: FONT_WEIGHT_BOLD,
        },
      };
    case 'passiveSecondary':
      return {
        color: colors.base,
        opacity: 1,
        outline: {
          offset: 0,
          width: TOD_HALO_THICKNESS,
          color: colors.soft,
          opacity: TOD_HALO_OPACITY,
        },
        label: {
          color: colors.strong,
          background: { color: colors.surface, border: colors.base },
          fontWeight: FONT_WEIGHT_REGULAR,
        },
      };
    case 'drag':
      // TODO: not reached yet, the TOD drag is still rendered by
      // DraggingOccupancyZonesLayer with hardcoded values. Wiring the drag through
      // curveStyle (+ a dedicated OccupancyDragStyle) will be handled in a follow up PR.
      return {
        color: DRAGGED_CURVE_COLOR,
        opacity: 1,
        level: 1,
        thickness: 1.5,
        outline: { offset: 0, color: DRAGGED_CURVE_OUTLINE_COLOR },
        label: {
          color: colors.base,
          background: { color: colors.surface },
          fontWeight: FONT_WEIGHT_BOLD,
        },
      };
    default: {
      // Exhaustiveness check: TS fails to compile if a state is added to the
      // union without a case here.
      const _exhaustive: never = state;
      throw new Error(`Unhandled curve visual state: ${_exhaustive}`);
    }
  }
};

/**
 * Maps a curve visual state to its style primitives.
 *
 * `outOfSelection`, `outOfDrag` and `hovered` are transverse modifiers applied
 * on top of the state. When `hovered` is set it wins over the others. `chart:
 * 'tod'` restyles the result for the track-occupancy diagram.
 */
const getCurveStyle = (
  state: CurveVisualState,
  train: TrainForStyle,
  {
    outOfSelection = false,
    outOfDrag = false,
    hovered = false,
    hideStops = false,
    chart = 'std',
  }: StyleOptions = {}
): CurveStyle => {
  // The TOD never fades occupancies out.
  if (chart === 'tod') return getTodStyle(state, train, hovered);

  let style: CurveStyle;
  if (hovered) {
    style = getHoveredStyle(state, train);
  } else if (outOfDrag) {
    // Checked before outOfSelection: during a drag both flags are set, and the
    // lighter drag fade must win.
    style = { ...getBaseStyle(state, train), opacity: OUT_OF_DRAG_OPACITY };
  } else if (outOfSelection) {
    const { colors } = train;
    style = {
      color: colors.base,
      opacity: OUT_OF_SELECTION_OPACITY,
      label: {
        color: colors.base,
        fontWeight: FONT_WEIGHT_REGULAR,
        background: RESTING_LABEL_BACKGROUND,
        opacity: OUT_OF_SELECTION_OPACITY,
      },
    };
  } else {
    style = getBaseStyle(state, train);
  }

  return hideStops ? { ...style, stop: { ...style.stop, thickness: 0 } } : style;
};

export default getCurveStyle;
