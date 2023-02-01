import React from 'react';
import { ComponentStory, ComponentMeta } from '@storybook/react';
import SpeedSpaceChart from 'applications/operationalStudies/components/SimulationResults/SpeedSpaceChart/SpeedSpaceChart';
import ORSD_GEV_SAMPLE_DATA from 'applications/operationalStudies/components/SimulationResults/SpeedSpaceChart/sampleData';
import 'styles/main.css';
export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/react/configure/overview#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'TrainSimulation/SpeedSpaceChart',
  component: SpeedSpaceChart,
};

const Template: ComponentStory<typeof SpeedSpaceChart> = (args) => (
  <div className="simulation-results">
    <div className="speedspacechart-container">
      <SpeedSpaceChart initialHeightOfSpeedSpaceChart={400} {...args} />
    </div>
  </div>
);

export const Standard = Template.bind({});

Standard.args = {
  heightOfSpeedSpaceChart: 250,
  dispatch: () => {},
  toggleSetting: () => {},
  onSetSettings: () => {},
  dispatchUpdateMustRedraw: () => {},
  onSetBaseHeightOfSpeedSpaceChart: () => {},
};
