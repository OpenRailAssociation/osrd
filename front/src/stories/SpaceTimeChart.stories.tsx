import React from 'react';
import type { StoryFn } from '@storybook/react';
import 'stories/storybook.css';
import SpaceTimeChart from 'modules/simulationResult/components/SpaceTimeChart/SpaceTimeChart';
import ORSD_GRAPH_SAMPLE_DATA from 'modules/simulationResult/components/sampleData';
import type { AllowancesSettings, Train } from 'reducers/osrdsimulation/types';

export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/react/configure/overview#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'TrainSimulation/SpaceTimeChart',
  component: SpaceTimeChart,
};

const Template: StoryFn<typeof SpaceTimeChart> = (args) => (
  <div className="simulation-results">
    <div className="chart-container">
      <SpaceTimeChart {...args} />
    </div>
  </div>
);

export const Standard = Template.bind({});

Standard.args = {
  allowancesSettings: ORSD_GRAPH_SAMPLE_DATA.allowancesSettings as AllowancesSettings,
  inputSelectedTrain: ORSD_GRAPH_SAMPLE_DATA.simulation.present.trains[0] as Train,
  simulation: ORSD_GRAPH_SAMPLE_DATA.simulation.present,
};
