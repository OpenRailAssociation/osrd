import { SECOND, MINUTE, HOUR, FONT_SIZE, FONT_MONO } from '../../common/consts';
import { BLACK_100, SKY_700, GREY_10, GREY_30, GREY_50, AMBER_100, EMERALD_100, ROSE_200 } from '../../common/helpers/colors';
import { type SpaceTimeChartTheme } from './types';


// Occupancy blocks colors :
export const OCCUPANCY_FREE = EMERALD_100;
export const OCCUPANCY_SEMAPHORE = ROSE_200;
export const OCCUPANCY_WARNING = AMBER_100;

export const DEFAULT_THEME: SpaceTimeChartTheme = {
  background: 'white',
  breakpoints: [0.2, 0.4, 0.7, 2, 6, 20, 60, Infinity],
  timeRanges: [
    10 * SECOND,
    30 * SECOND,
    1 * MINUTE,
    5 * MINUTE,
    15 * MINUTE,
    30 * MINUTE,
    1 * HOUR,
    3 * HOUR,
    6 * HOUR,
    12 * HOUR,
    24 * HOUR,
  ],
  pathsStyles: {
    fontSize: FONT_SIZE,
    fontFamily: FONT_MONO,
  },
  spaceGraduationsStyles: {
    1: {
      width: 0.5,
      color: SKY_700,
      opacity: 0.75,
    },
    2: {
      width: 0.5,
      color: SKY_700,
      opacity: 0.25,
    },
    3: {
      width: 0.5,
      color: GREY_10,
    },
  },
  // The following matrix indicate, for various zoom levels, what time marks should be represented,
  // and with which priority level:
  // - Each line corresponds to a breakpoint, in the same order as in the BREAKPOINTS array
  // - Each column corresponds to a time range, in the same order as in the TIME_RANGES array
  timeCaptionsSize: 40,
  timeCaptionsPriorities: [
    [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
    [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
    [0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 1],
    [0, 0, 0, 0, 0, 3, 1, 1, 1, 1, 1],
    [0, 0, 0, 0, 3, 1, 1, 1, 1, 1, 1],
    [0, 0, 0, 3, 2, 1, 1, 1, 1, 1, 1],
    [0, 0, 3, 2, 1, 1, 1, 1, 1, 1, 1],
    [0, 0, 3, 1, 1, 1, 1, 1, 1, 1, 1],
  ],
  timeCaptionsStyles: {
    1: {
      color: GREY_50,
      font: `12px ${FONT_MONO}, monospace';`,
      topOffset: 12,
    },
    2: {
      color: GREY_30,
      font: `12px ${FONT_MONO}, monospace';`,
      topOffset: 12,
    },
    3: {
      color: GREY_30,
      font: `10px ${FONT_MONO}, monospace';`,
      topOffset: 6,
    },
  },
  dateCaptionsSize: 0,
  dateCaptionsStyle: {
    color: GREY_30,
    font: `10px ${FONT_MONO}, monospace';`,
    topOffset: 28,
    textAlign: 'left',
  },
  // The following matrix indicate, for various zoom levels, what time marks should be represented,
  // and with which priority level:
  // - Each line corresponds to a breakpoint, in the same order as in the BREAKPOINTS array
  // - Each column corresponds to a time range, in the same order as in the TIME_RANGES array
  timeGraduationsPriorities: [
    [0, 0, 0, 0, 0, 0, 0, 6, 4, 2, 1],
    [0, 0, 0, 0, 0, 0, 6, 5, 5, 2, 1],
    [0, 0, 0, 0, 0, 6, 4, 3, 3, 2, 1],
    [0, 0, 0, 0, 6, 5, 4, 3, 2, 2, 1],
    [0, 0, 0, 6, 5, 4, 3, 2, 2, 2, 1],
    [0, 0, 6, 5, 4, 4, 3, 2, 2, 2, 1],
    [0, 6, 5, 4, 3, 3, 2, 2, 2, 2, 1],
    [6, 5, 4, 3, 3, 3, 2, 2, 2, 2, 1],
  ],
  timeGraduationsStyles: {
    1: {
      width: 0.75,
      color: BLACK_100,
      opacity: 0.5,
    },
    2: {
      width: 0.5,
      color: SKY_700,
      opacity: 0.7,
    },
    3: {
      width: 0.5,
      color: SKY_700,
      opacity: 0.7,
      dashArray: [80, 8],
    },
    4: {
      width: 0.5,
      color: SKY_700,
      opacity: 0.7,
      dashArray: [16, 4],
    },
    5: {
      width: 0.5,
      color: SKY_700,
      opacity: 0.7,
      dashArray: [8, 8],
    },
    6: {
      width: 0.5,
      color: SKY_700,
      opacity: 0.25,
    },
  },
};
