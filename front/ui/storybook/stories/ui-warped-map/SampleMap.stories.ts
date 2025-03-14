import type { Meta, StoryObj } from '@storybook/react';

import { PATH_EXTRA_LONG, PATH_LONG, PATH_MEDIUM, PATH_NAMES, PATH_SHORT } from './helpers';
import SampleMap from './SampleMap';

const meta: Meta<typeof SampleMap> = {
  component: SampleMap,
  title: 'WarpedMap/Sample Maps',
  argTypes: {
    path: {
      options: PATH_NAMES,
      control: { type: 'radio' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof SampleMap>;

export const PathShort: Story = {
  name: 'Short path',
  args: {
    path: PATH_SHORT,
  },
};
export const PathMedium: Story = {
  name: 'Medium path',
  args: {
    path: PATH_MEDIUM,
  },
};
export const PathLong: Story = {
  name: 'Long path',
  args: {
    path: PATH_LONG,
  },
};
export const PathLonger: Story = {
  name: 'Longer path',
  args: {
    path: PATH_EXTRA_LONG,
  },
};
