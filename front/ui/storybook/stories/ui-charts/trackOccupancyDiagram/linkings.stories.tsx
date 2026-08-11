import React, { useMemo, useState } from 'react';

import {
  TrackOccupancyStandalone,
  isLinkingPickingElement,
  useHoveredPickingElement,
} from '@osrd-project/ui-charts';
import type { Meta, StoryObj } from '@storybook/react-vite';

import '@osrd-project/ui-charts/dist/theme.css';

import { BROKEN_LINKINGS, LINKING_OCCUPANCY_ZONES, LINKINGS } from './assets/linkings';
import TRACKS from './assets/tracks';
import trashIcon from './assets/trash-white.svg';

import './styles/track-occupancy.css';

const TrackOccupancyLinkingsStory = () => {
  const { hoveredElement, handleHoveredChildUpdate } =
    useHoveredPickingElement(isLinkingPickingElement);
  const [brokenLinkings, setBrokenLinkings] = useState(BROKEN_LINKINGS);

  const linkings = useMemo(
    () =>
      LINKINGS.map((linking) => ({ ...linking, hover: linking.id === hoveredElement?.linkingId })),
    [hoveredElement]
  );

  return (
    <div
      id="track-occupancy-diagram-linkings-story"
      className="bg-ambientB-10"
      style={{ cursor: hoveredElement ? 'pointer' : undefined }}
    >
      <TrackOccupancyStandalone
        tracks={TRACKS}
        occupancyZones={LINKING_OCCUPANCY_ZONES}
        linkings={linkings}
        brokenLinkings={brokenLinkings}
        deleteIconUrl={trashIcon}
        onDeleteBrokenLinking={(id) =>
          setBrokenLinkings((prev) => prev.filter((brokenLinking) => brokenLinking.id !== id))
        }
        onHoveredChildUpdate={handleHoveredChildUpdate}
        height={500}
      />
    </div>
  );
};

const meta: Meta<typeof TrackOccupancyLinkingsStory> = {
  title: 'TrackOccupancyDiagram/Linkings',
  component: TrackOccupancyLinkingsStory,
  render: () => <TrackOccupancyLinkingsStory />,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof TrackOccupancyLinkingsStory>;

export const LinkingsStoryDefault: Story = {};
