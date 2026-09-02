import React, { useMemo, useState } from 'react';

import {
  TrackOccupancyStandalone,
  isBrokenLinkingPickingElement,
  isLinkingPickingElement,
  useHoveredPickingElement,
} from '@osrd-project/ui-charts';
import type { PickingElement } from '@osrd-project/ui-charts';
import type { Meta, StoryObj } from '@storybook/react-vite';

import '@osrd-project/ui-charts/dist/theme.css';

import { BROKEN_LINKINGS, LINKING_OCCUPANCY_ZONES, LINKINGS } from './assets/linkings';
import TRACKS from './assets/tracks';
import trashIcon from './assets/trash-white.svg';

import './styles/track-occupancy.css';

/** Both kinds of linking answer to the mouse, so both drive the pointer cursor. */
const isAnyLinkingPickingElement = (element: PickingElement) =>
  isLinkingPickingElement(element) || isBrokenLinkingPickingElement(element);

const TrackOccupancyLinkingsStory = ({ editingLinkings }: { editingLinkings: boolean }) => {
  const { hoveredElement, handleHoveredChildUpdate } = useHoveredPickingElement(
    isAnyLinkingPickingElement
  );
  const [brokenLinkings, setBrokenLinkings] = useState(BROKEN_LINKINGS);

  const hovered = editingLinkings ? hoveredElement : undefined;
  const hoveredLinkingId =
    hovered && isLinkingPickingElement(hovered) ? hovered.linkingId : undefined;
  const hoveredBadge = hovered && isBrokenLinkingPickingElement(hovered) ? hovered : undefined;

  const linkings = useMemo(
    () => LINKINGS.map((linking) => ({ ...linking, hover: linking.id === hoveredLinkingId })),
    [hoveredLinkingId]
  );
  const hoveredBrokenLinkings = useMemo(
    () =>
      brokenLinkings.map((brokenLinking) => ({
        ...brokenLinking,
        hover:
          brokenLinking.id === hoveredBadge?.brokenLinkingId &&
          brokenLinking.direction === hoveredBadge.direction,
      })),
    [brokenLinkings, hoveredBadge]
  );

  return (
    <div
      id="track-occupancy-diagram-linkings-story"
      className="bg-ambientB-10"
      style={{ cursor: hovered ? 'pointer' : undefined }}
    >
      <TrackOccupancyStandalone
        tracks={TRACKS}
        occupancyZones={LINKING_OCCUPANCY_ZONES}
        linkings={linkings}
        brokenLinkings={hoveredBrokenLinkings}
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
  args: {
    editingLinkings: true,
  },
  argTypes: {
    editingLinkings: {
      name: 'Editing linkings?',
      description:
        'Linkings only answer to the mouse while the user may create and delete them: off, hovering one neither highlights it nor offers to delete it.',
      control: { type: 'boolean' },
    },
  },
  render: (args) => <TrackOccupancyLinkingsStory {...args} />,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof TrackOccupancyLinkingsStory>;

export const LinkingsStoryDefault: Story = {};
