import React, { useMemo, useState, useCallback } from 'react';

import {
  TrackOccupancyStandalone,
  isOccupancyPickingElement,
  useHoveredPickingElement,
} from '@osrd-project/ui-charts';
import type { Meta, StoryObj } from '@storybook/react-vite';

import OCCUPANCY_ZONES from './assets/occupancyZones';
import TRACKS from './assets/tracks';

import './styles/track-occupancy.css';

const TrackOccupancyDiagramStory = () => {
  const [allOccupancyZones, setAllOccupancyZones] = useState(OCCUPANCY_ZONES);
  const [hoveredTrackId, setHoveredTrackId] = useState<string>();
  const [draggingPathId, setDraggingPathId] = useState<string>();
  const { hoveredElement, handleHoveredChildUpdate } =
    useHoveredPickingElement(isOccupancyPickingElement);
  const hoveredPathId = hoveredElement?.pathId;

  const { occupancyZones, draggingOccupancyZones } = useMemo(
    () => ({
      occupancyZones: allOccupancyZones.filter((zone) => zone.pathId !== draggingPathId),
      draggingOccupancyZones: allOccupancyZones.filter((zone) => zone.pathId === draggingPathId),
    }),
    [allOccupancyZones, draggingPathId]
  );

  const handleMouseDown = useCallback(() => {
    setDraggingPathId(hoveredPathId);
  }, [hoveredPathId]);

  const handleMouseUp = useCallback(() => {
    if (draggingPathId && hoveredTrackId) {
      setAllOccupancyZones((prev) =>
        prev.map((zone) =>
          zone.pathId === draggingPathId ? { ...zone, trackId: hoveredTrackId } : zone
        )
      );
    }

    setDraggingPathId(undefined);
  }, [draggingPathId, hoveredTrackId]);

  return (
    <div
      id="track-occupancy-diagram-base-story"
      className="bg-ambientB-10"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      <TrackOccupancyStandalone
        tracks={TRACKS}
        occupancyZones={occupancyZones}
        draggingOccupancyZones={draggingOccupancyZones}
        onHoveredChildUpdate={handleHoveredChildUpdate}
        onDragOver={setHoveredTrackId}
        height={500}
      />
    </div>
  );
};

/**
 * Track occupancy diagram interactions.
 *
 * Occupancy zones can be dragged and dropped to a new track.
 */
const meta: Meta<typeof TrackOccupancyDiagramStory> = {
  title: 'TrackOccupancyDiagram/Interactions',
  component: TrackOccupancyDiagramStory,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof TrackOccupancyDiagramStory>;

export const TrackOccupancyDiagramStoryDefault: Story = {};
