import React from 'react';
import { noop } from 'lodash';
import { StoryFn } from '@storybook/react';
import SpeedSpaceChart, {
  SpeedSpaceChartProps,
} from 'modules/simulationResult/components/SpeedSpaceChart/SpeedSpaceChart';
import 'stories/storybook.css';
import { Provider } from 'react-redux';
import { store } from 'store';
import ORSD_GRAPH_SAMPLE_DATA from 'modules/simulationResult/components/sampleData';

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
