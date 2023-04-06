// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React from 'react';

import { IsolatedSpeedLimitByTagSelector } from 'common/SpeedLimitByTagSelector/SpeedLimitByTagSelector';

const SAMPLE_DATA = ['First Category of Speed Limits', 'Second Category of Speed Limits'];

export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/react/configure/overview#configure-story-loading
   * to learn how to generate automatic titles
   */
  component: IsolatedSpeedLimitByTagSelector,
  title: 'TrainSimulation/SpeedLimitByTagSelector',
};

export const Plain = { args: { condensed: false, speedLimitsByTagsFromApi: SAMPLE_DATA } };

export const Condensed = { args: { condensed: true, speedLimitsByTagsFromApi: SAMPLE_DATA } };
