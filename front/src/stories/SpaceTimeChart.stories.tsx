import React from 'react';
import { ComponentStory, ComponentMeta } from '@storybook/react';
import SpaceTimeChart from 'applications/operationalStudies/components/SimulationResults/SpaceTimeChart/SpaceTimeChart';
import 'styles/main.css';
import ORSD_GEV_SAMPLE_DATA from 'applications/operationalStudies/components/SimulationResults/SpeedSpaceChart/sampleData';

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
    <div className="speedspacechart-container">
      <SpaceTimeChart initialHeightOfSpaceTimeChart={400} {...args} />
    </div>
  </div>
);

export const Standard = Template.bind({});

Standard.args = {
  timePosition: ORSD_GEV_SAMPLE_DATA.timePosition,
};
