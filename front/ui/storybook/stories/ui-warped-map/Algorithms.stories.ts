import { DEFAULT_WARPING_OPTIONS } from '@osrd-project/ui-warped-map';
import type { Meta, StoryObj } from '@storybook/react-vite';

import Algorithms from './Algorithms';
import { PATH_LONG, PATH_NAMES } from './helpers';

const meta: Meta<typeof Algorithms> = {
  component: Algorithms,
  title: 'WarpedMap/Algorithms',
  argTypes: {
    path: {
      name: 'Path',
      description: 'Which path to warp on',
      options: PATH_NAMES,
      defaultValue: PATH_LONG,
      control: { type: 'radio' },
    },
    tolerance: {
      name: 'Tolerance',
      description: 'The tolerance for turf.simplify',
      defaultValue: DEFAULT_WARPING_OPTIONS.tolerance,
      type: 'number',
      control: {
        type: 'range',
        min: 0,
        max: 1,
        step: 0.005,
        defaultValue: DEFAULT_WARPING_OPTIONS.tolerance,
      },
    },
    stripsPerSide: {
      name: 'Strips per side',
      description: 'The number of strips on each side of the grid',
      defaultValue: DEFAULT_WARPING_OPTIONS.stripsPerSide,
      type: 'number',
      control: {
        type: 'number',
        min: 1,
        step: 1,
        defaultValue: DEFAULT_WARPING_OPTIONS.stripsPerSide,
      },
    },
    samplesCount: {
      name: 'Samples count',
      description: 'The number of samples on the grid',
      defaultValue: DEFAULT_WARPING_OPTIONS.samplesCount,
      type: 'number',
      control: {
        type: 'number',
        min: 3,
        step: 1,
        defaultValue: DEFAULT_WARPING_OPTIONS.samplesCount,
      },
    },
    straightenForce: {
      name: 'Straighten force',
      description: 'The strength of the force to strengthen on.',
      defaultValue: DEFAULT_WARPING_OPTIONS.straightenForce,
      type: 'number',
      control: {
        type: 'range',
        min: 0,
        max: 1,
        step: 0.005,
        defaultValue: DEFAULT_WARPING_OPTIONS.straightenForce,
      },
    },
    straightenIterations: {
      name: 'Straighten iterations',
      description: 'The number of strenghtening iterations.',
      defaultValue: DEFAULT_WARPING_OPTIONS.straightenIterations,
      type: 'number',
      control: {
        type: 'number',
        min: 1,
        step: 1,
        defaultValue: DEFAULT_WARPING_OPTIONS.straightenIterations,
      },
    },
    quadtreeDepth: {
      name: 'Quadtree depth',
      description: 'The maximum depth of the quadtree',
      defaultValue: DEFAULT_WARPING_OPTIONS.quadtreeDepth,
      type: 'number',
      control: {
        type: 'number',
        min: 1,
        step: 1,
        defaultValue: DEFAULT_WARPING_OPTIONS.quadtreeDepth,
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Algorithms>;

export const DefaultSettings: Story = {
  name: 'Default settings',
  args: {
    path: PATH_LONG,
    tolerance: DEFAULT_WARPING_OPTIONS.tolerance,
    stripsPerSide: DEFAULT_WARPING_OPTIONS.stripsPerSide,
    samplesCount: DEFAULT_WARPING_OPTIONS.samplesCount,
    straightenForce: DEFAULT_WARPING_OPTIONS.straightenForce,
    straightenIterations: DEFAULT_WARPING_OPTIONS.straightenIterations,
    quadtreeDepth: DEFAULT_WARPING_OPTIONS.quadtreeDepth,
  },
};
