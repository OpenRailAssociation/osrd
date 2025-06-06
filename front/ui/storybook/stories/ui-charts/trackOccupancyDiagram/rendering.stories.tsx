import React, { useEffect, useState } from 'react';

import { TrackOccupancyStandalone } from '@osrd-project/ui-charts';
import type { Meta, StoryObj } from '@storybook/react-vite';

import OCCUPANCY_ZONES from './assets/occupancyZones';
import TRACKS from './assets/tracks';

import './styles/track-occupancy.css';

const SELECTED_TRAIN_ID = '5';

const TrackOccupancyDiagramStory = ({
  trainId,
  autoHeight,
}: {
  trainId: number;
  autoHeight?: boolean;
}) => {
  const [selectedTrainId, setSelectedTrainId] = useState<string>();

  useEffect(() => {
    setSelectedTrainId(`${trainId}`);
  }, [trainId]);

  return (
    <div id="track-occupancy-diagram-base-story" className="bg-ambientB-10">
      <TrackOccupancyStandalone
        tracks={TRACKS}
        occupancyZones={OCCUPANCY_ZONES}
        selectedTrainId={selectedTrainId}
        onSelectedTrainIdChange={setSelectedTrainId}
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
  },
};
