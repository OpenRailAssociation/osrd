import React from 'react';
import { ComponentStory, ComponentMeta } from '@storybook/react';
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
  <div className="speedspacechart-container simulation-results">
    <div className="spacetime-chart">
      <SpeedSpaceChart {...args} />
    </div>
  </div>
);

export const Standard = Template.bind({});
