import { noop } from 'lodash';

import SpeedLimitByTagSelector from 'common/SpeedLimitByTagSelector/SpeedLimitByTagSelector';

const selectedSpeedLimitByTag = 'First Category of Speed Limits';
const speedLimitsByTags = [selectedSpeedLimitByTag, 'Second Category of Speed Limits'];

export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/react/configure/overview#configure-story-loading
   * to learn how to generate automatic titles
   */
  component: SpeedLimitByTagSelector,
  title: 'TrainSimulation/SpeedLimitByTagSelector',
};

const defaultArgs = {
  selectedSpeedLimitByTag,
  speedLimitsByTags,
  dispatchUpdateSpeedLimitByTag: noop,
};

export const Plain = { args: { condensed: false, ...defaultArgs } };

export const Condensed = { args: { condensed: true, ...defaultArgs } };
