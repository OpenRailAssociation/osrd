import { Manchette } from '@osrd-project/ui-charts';
import '@osrd-project/ui-core/dist/theme.css';
import '@osrd-project/ui-charts/dist/theme.css';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { SAMPLE_WAYPOINTS } from './assets/sampleData';

const meta: Meta<typeof Manchette> = {
  component: Manchette,
  title: 'Manchette/Manchette',
  tags: ['autodocs'],
  argTypes: {
    contents: {
      control: {
        type: 'object',
      },
    },
    zoomYIn: {
      action: 'zoomYIn',
    },
    zoomYOut: {
      action: 'zoomYOut',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Manchette>;

export const Default: Story = {
  args: {
    contents: SAMPLE_WAYPOINTS,
  },
};
