import type { CurveOutline, CurveStyle } from '@osrd-project/ui-charts';

import { REST_BACKGROUND_COLOR } from 'applications/operationalStudies/consts';
import type { CategoryColors } from 'applications/operationalStudies/types';
import type { CurveVisualState } from 'modules/simulationResult/types';

export const INVALID_OUTLINE: CurveOutline = {
  offset: 4,
  color: 'transparent',
  backgroundColor: 'rgba(0, 0, 0, 0.05)',
};

const FONT_WEIGHT_REGULAR = 400;
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

  switch (state) {
    case 'none':
      return noneStyle;
    default:
      // Other states are implemented in following commits.
      return { color: colors.normal, opacity: 1 };
  }
};

export default getCurveStyle;
