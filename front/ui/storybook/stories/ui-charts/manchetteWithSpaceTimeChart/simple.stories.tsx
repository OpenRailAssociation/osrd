import { ManchetteWithSpaceTimeChart } from '@osrd-project/ui-charts';
import type { Meta, StoryObj } from '@storybook/react-vite';

import '@osrd-project/ui-charts/dist/theme.css';
import '@osrd-project/ui-core/dist/theme.css';

import { SAMPLE_CHART_PATHS, SAMPLE_WAYPOINTS } from './assets/sampleData';

const meta: Meta<typeof ManchetteWithSpaceTimeChart> = {
  title: 'Manchette with SpaceTimeChart/Component API',
  component: ManchetteWithSpaceTimeChart,
};

export default meta;

export const Default: StoryObj<typeof ManchetteWithSpaceTimeChart> = {
  args: {
    waypoints: SAMPLE_WAYPOINTS,
    paths: SAMPLE_CHART_PATHS,
  },
};
