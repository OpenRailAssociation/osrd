import React from 'react';

import type { StoryFn } from '@storybook/react';
import { noop } from 'lodash';
import { Provider } from 'react-redux';

import ORSD_GRAPH_SAMPLE_DATA from 'modules/simulationResult/components/sampleData';
import SpeedSpaceChart, {
  type SpeedSpaceChartProps,
} from 'modules/simulationResult/components/SpeedSpaceChart/SpeedSpaceChart';
import 'stories/storybook.css';
import { store } from 'store';

export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/react/configure/overview#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'TrainSimulation/SpeedSpaceChart',
  component: SpeedSpaceChart,
};

const Template: StoryFn<SpeedSpaceChartProps & { heightOfSpeedSpaceChart: number }> = (args) => (
  <Provider store={store}>
    <div className="simulation-results">
      <div className="chart-container">
        <SpeedSpaceChart {...args} />
      </div>
    </div>
  </Provider>
);

export const Standard = Template.bind({});

Standard.args = {
  heightOfSpeedSpaceChart: 250,
  initialHeight: 400,
  onSetChartBaseHeight: noop,
  selectedTrain: ORSD_GRAPH_SAMPLE_DATA.simulation.present.trains[0],
};
