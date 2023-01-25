import React from 'react';
import { ComponentStory, ComponentMeta } from '@storybook/react';
import SpaceTimeChart from 'applications/operationalStudies/components/SimulationResults/SpaceTimeChart/SpaceTimeChart';
import 'styles/main.css';

export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/react/configure/overview#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'TrainSimulation/SpaceTimeChart',
  component: SpaceTimeChart,
};

const Template: ComponentStory<typeof SpaceTimeChart> = (args) => (
  <div className="spacetimechart-container simulation-results">
    <SpaceTimeChart initialHeightOfSpaceTimeChart={400} {...args} />
  </div>
);

export const Standard = Template.bind({});
