import React, { useEffect, useState } from 'react';

import '@osrd-project/ui-core/dist/theme.css';
import '@osrd-project/ui-charts/dist/theme.css';
import {
  SpaceGraduations,
  SpeedSpaceDiagram,
  type SpeedSpaceDiagramProps,
} from '@osrd-project/ui-charts';
import type { Meta, StoryObj } from '@storybook/react-vite';

const SpeedSpaceDiagramStory = ({ height, width, background }: SpeedSpaceDiagramProps) => {
  const [containerHeight, setContainerHeight] = useState(460);

  useEffect(() => {
    setContainerHeight(height);
  }, [height]);

  return (
    <div style={{ height, width }}>
      <SpeedSpaceDiagram
        width={width}
        height={containerHeight}
        background={background}
        speedScale={120}
        spaceOrigin={0}
        spaceScale={120000}
      >
        <SpaceGraduations />
      </SpeedSpaceDiagram>
    </div>
  );
};

const meta: Meta<typeof SpeedSpaceDiagram> = {
  title: 'SpeedSpaceDiagram',
  component: SpeedSpaceDiagram,
  decorators: [(Story) => <Story />],
  args: {
    width: 1440,
    height: 521.5,
    background: 'rgb(247, 246, 238)',
  },

  render: (args) => <SpeedSpaceDiagramStory {...args} />,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof SpeedSpaceDiagram>;

export const SpeedSpaceDiagramDefault: Story = {
  args: {
    width: 1440,
    height: 521.5,
    background: 'rgb(247, 246, 238)',
  },
};
