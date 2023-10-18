import React from 'react';
import { ComponentStory } from '@storybook/react';
import SpaceTimeChart from 'modules/simulationResult/components/SpaceTimeChart/SpaceTimeChart';
import 'stories/storybook.css';
import ORSD_GEV_SAMPLE_DATA from 'modules/simulationResult/components/SpeedSpaceChart/sampleData';

export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/react/configure/overview#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'TrainSimulation/SpaceTimeChart',
  component: SpaceTimeChart,
};

const Template: ComponentStory<typeof SpaceTimeChart> = (args) => (
  <div className="simulation-results">
    <div className="chart-container">
      <SpaceTimeChart {...args} />
    </div>
  </div>
);

export const Standard = Template.bind({});

Standard.args = {
  timePosition: ORSD_GEV_SAMPLE_DATA.timePosition,
};
