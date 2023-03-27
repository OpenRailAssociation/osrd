import React from 'react';
import { noop } from 'lodash';
import { ComponentStory } from '@storybook/react';
import SpeedSpaceChart from 'applications/operationalStudies/components/SimulationResults/SpeedSpaceChart/SpeedSpaceChart';
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
      <SpeedSpaceChart initialHeight={400} {...args} />
    </div>
  </div>
);

export const Standard = Template.bind({});

Standard.args = {
  heightOfSpeedSpaceChart: 250,
  dispatch: noop,
  toggleSetting: noop,
  onSetSettings: noop,
  dispatchUpdateMustRedraw: noop,
  onSetChartBaseHeight: noop,
};
