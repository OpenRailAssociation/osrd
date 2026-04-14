import { ManchetteWithSpaceTimeChart } from '@osrd-project/ui-charts';
import type { Meta } from '@storybook/react-vite';

import '@osrd-project/ui-charts/dist/theme.css';
import '@osrd-project/ui-core/dist/theme.css';

import { SAMPLE_CHART_PATHS, SAMPLE_WAYPOINTS } from './assets/sampleData';

const meta: Meta<typeof ManchetteWithSpaceTimeChart> = {
  title: 'Manchette with SpaceTimeChart/Component API',
  component: ManchetteWithSpaceTimeChart,
};

export default meta;

export const Default = {
  args: {
    waypoints: SAMPLE_WAYPOINTS,
    projectPathTrainResult: SAMPLE_CHART_PATHS,
    selectedTrain: 1,
  },
};
