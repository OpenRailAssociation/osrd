import React, { useMemo, useState, useCallback } from 'react';

import {
  TrackOccupancyStandalone,
  type SpaceTimeChartProps,
  isOccupancyPickingElement,
} from '@osrd-project/ui-charts';
import type { Meta, StoryObj } from '@storybook/react-vite';

import OCCUPANCY_ZONES from './assets/occupancyZones';
import TRACKS from './assets/tracks';

import './styles/track-occupancy.css';

const TrackOccupancyDiagramStory = () => {
  const [allOccupancyZones, setAllOccupancyZones] = useState(OCCUPANCY_ZONES);
  const [hoveredTrainId, setHoveredTrainId] = useState<string>();
  const [hoveredTrackId, setHoveredTrackId] = useState<string>();
  const [draggingTrainId, setDraggingTrainId] = useState<string>();

  const { occupancyZones, draggingOccupancyZones } = useMemo(
    () => ({
      occupancyZones: allOccupancyZones.filter((zone) => zone.trainId !== draggingTrainId),
      draggingOccupancyZones: allOccupancyZones.filter((zone) => zone.trainId === draggingTrainId),
    }),
    [allOccupancyZones, draggingTrainId]
  );

  const handleHoveredChildUpdate: SpaceTimeChartProps['onHoveredChildUpdate'] = useCallback(
    ({ item }) => {
      setHoveredTrainId(
        item && isOccupancyPickingElement(item.element) ? item.element.pathId : undefined
      );
    },
    []
  );

  const handleMouseDown = useCallback(() => {
    setDraggingTrainId(hoveredTrainId);
  }, [hoveredTrainId]);

  const handleMouseUp = useCallback(() => {
    if (draggingTrainId && hoveredTrackId) {
      setAllOccupancyZones((prev) =>
        prev.map((zone) =>
          zone.trainId === draggingTrainId ? { ...zone, trackId: hoveredTrackId } : zone
        )
      );
    }

    setDraggingTrainId(undefined);
  }, [draggingTrainId, hoveredTrackId]);

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
