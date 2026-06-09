import React, { useEffect, useState } from 'react';

import { TrackOccupancyStandalone } from '@osrd-project/ui-charts';
import type { Meta, StoryObj } from '@storybook/react-vite';

import OCCUPANCY_ZONES from './assets/occupancyZones';
import TRACKS from './assets/tracks';

import './styles/track-occupancy.css';

const SELECTED_TRAIN_ID = '5';
const DRAGGING_OCCUPANCY_ZONES = [OCCUPANCY_ZONES[0], OCCUPANCY_ZONES[2]];

const TrackOccupancyDiagramStory = ({
  trainId,
  autoHeight,
  isDragging,
}: {
  trainId: number;
  autoHeight?: boolean;
  isDragging?: boolean;
}) => {
  const [selectedPathId, setSelectedPathId] = useState<string>();

  useEffect(() => {
    // TODO: fix this lint
    /* eslint-disable-next-line react-hooks-js/set-state-in-effect */
    setSelectedPathId(`${trainId}`);
  }, [trainId]);

  return (
    <div id="track-occupancy-diagram-base-story" className="bg-ambientB-10">
      <TrackOccupancyStandalone
        tracks={TRACKS}
        occupancyZones={OCCUPANCY_ZONES}
        draggingOccupancyZones={isDragging ? DRAGGING_OCCUPANCY_ZONES : undefined}
        selectedPathId={selectedPathId}
        onSelectedPathIdChange={setSelectedPathId}
        height={autoHeight ? undefined : 500}
      />
    </div>
  );
};

const meta: Meta<typeof TrackOccupancyDiagramStory> = {
  title: 'TrackOccupancyDiagram/Rendering',
  component: TrackOccupancyDiagramStory,
  decorators: [(Story) => <Story />],
  parameters: {
    backgrounds: {
      default: 'lightSand',
      values: [
        {
          name: 'lightSand',
          value: 'rgba(247, 246, 238, var(--tw-bg-opacity, 1))',
        },
      ],
    },
  },
  args: {
    trainId: +SELECTED_TRAIN_ID,
  },
  render: (args) => <TrackOccupancyDiagramStory {...args} />,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof TrackOccupancyDiagramStory>;

export const TrackOccupancyDiagramStoryDefault: Story = {
  args: {
    trainId: 5,
    autoHeight: false,
    isDragging: false,
  },
};
