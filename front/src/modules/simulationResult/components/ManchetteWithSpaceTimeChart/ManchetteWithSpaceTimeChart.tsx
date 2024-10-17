/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useState } from 'react';

import { Manchette } from '@osrd-project/ui-manchette';
import { useManchettesWithSpaceTimeChart } from '@osrd-project/ui-manchette-with-spacetimechart';
import { SpaceTimeChart, PathLayer } from '@osrd-project/ui-spacetimechart';
import cx from 'classnames';
import type { TrainSpaceTimeData } from 'applications/operationalStudies/types';
import type {
  SpaceTimeChartProps,
  HoveredItem,
} from '@osrd-project/ui-spacetimechart/dist/lib/types';

type ManchetteWithSpaceTimeChartProps = {
  operationalPoints: any[];
  projectPathTrainResult: TrainSpaceTimeData[];
  selectedTrainScheduleId?: number;
  handleTrainDrag?: (trainId: number, newDepartureTime: string, isPanning: boolean) => void;
};
const DEFAULT_HEIGHT = 561;

const ManchetteWithSpaceTimeChartWrapper = ({
  operationalPoints,
  projectPathTrainResult,
  selectedTrainScheduleId,
  handleTrainDrag,
}: ManchetteWithSpaceTimeChartProps) => {
  const manchetteWithSpaceTimeChartRef = useRef<HTMLDivElement>(null);
  const [heightOfManchetteWithSpaceTimeChart] = useState(DEFAULT_HEIGHT);
  const [hoveredItem, setHoveredItem] = useState<null | HoveredItem>(null); // Ajoute un état pour l'élément survolé
  const [interactionState, setInteractionState] = useState<
    | { type: 'idle' }
    | { type: 'draggingItem'; id: number; initialDepartureTime: string }
    | { type: 'defaultBehavior' }
  >({ type: 'idle' });

  // Utilisation du hook pour obtenir les props
  const { manchetteProps, spaceTimeChartProps, handleScroll } = useManchettesWithSpaceTimeChart(
    operationalPoints,
    projectPathTrainResult,
    manchetteWithSpaceTimeChartRef,
    selectedTrainScheduleId
  );

  // Fonction de panning surchargée qui utilise panTarget
  const onPanOverloaded: SpaceTimeChartProps['onPan'] = (payload) => {
    // Handle "stopping interactions"
    if (!payload.isPanning) {
      if (interactionState.type === 'defaultBehavior') {
        spaceTimeChartProps.onPan(payload);
      } else if (handleTrainDrag && interactionState.type === 'draggingItem') {
        const path = projectPathTrainResult.find((res) => res.id === interactionState.id);
        if (!path)
          throw new Error(`No path has id ${hoveredItem} (given as 'interactionState.id')`);

        handleTrainDrag(path.id, path.departure_time, false);
      }

      setInteractionState({ type: 'idle' });
    }

    // Handle "starting interactions"
    else if (interactionState.type === 'idle') {
      if (handleTrainDrag && hoveredItem) {
        const hoveredPathId = +hoveredItem.element.pathId.split('-')[0]; // TODO: Clean that ID extraction
        const path = projectPathTrainResult.find((res) => res.id === hoveredPathId);
        if (!path) throw new Error(`No path has id ${hoveredItem} (given as 'hoveredItem')`);

        const initialDepartureTime = path.departure_time;
        setInteractionState({ type: 'draggingItem', id: hoveredPathId, initialDepartureTime });
      } else {
        setInteractionState({ type: 'defaultBehavior' });
        spaceTimeChartProps.onPan(payload);
      }
    }

    // Handle "continuing interactions"
    else if (interactionState.type === 'defaultBehavior') {
      spaceTimeChartProps.onPan(payload);
    } else if (handleTrainDrag && interactionState.type === 'draggingItem') {
      const { id, initialDepartureTime } = interactionState;
      const timeDiff = payload.data.time - payload.initialData.time;
      const initialDepartureTimeMS = +new Date(initialDepartureTime); // TODO: Fix string to number translation
      const newDepartureTimeMS = initialDepartureTimeMS + timeDiff;
      const newDepartureTime = new Date(newDepartureTimeMS).toISOString(); // TODO: Fix string to number translation

      handleTrainDrag(id, newDepartureTime, true);
    }
  };

  // Met à jour l'état de hoveredItem lors de l'événement onHoveredChildUpdate
  const handleHoveredChildUpdate: SpaceTimeChartProps['onHoveredChildUpdate'] = ({ item }) => {
    setHoveredItem(item);
  };

  return (
    <div className="manchette-space-time-chart-wrapper">
      <div className="header">
        {/* TODO : uncomment this component in #8628 */}
        {/* <ManchetteMenuButton /> */}
      </div>
      <div className="header-separator" />
      <div
        ref={manchetteWithSpaceTimeChartRef}
        style={{ height: `${heightOfManchetteWithSpaceTimeChart}px` }}
        className="manchette flex"
        onScroll={handleScroll}
      >
        <Manchette {...manchetteProps} />
        <div
          className="space-time-chart-container"
          style={{
            bottom: 0,
            left: 0,
            top: 0,
            height: `${heightOfManchetteWithSpaceTimeChart - 6}px`,
          }}
        >
          <SpaceTimeChart
            className={cx('inset-0 absolute h-full', {
              'cursor-grabbing': interactionState.type !== 'idle',
              'cursor-pointer': hoveredItem,
            })}
            spaceOrigin={0}
            timeOrigin={Math.min(...projectPathTrainResult.map((p) => +new Date(p.departure_time)))}
            {...spaceTimeChartProps}
            onPan={onPanOverloaded}
            onHoveredChildUpdate={handleHoveredChildUpdate}
          >
            {spaceTimeChartProps.paths.map((path) => (
              <PathLayer key={path.id} path={path} color={path.color} pickingTolerance={10} />
            ))}
          </SpaceTimeChart>
        </div>
      </div>
    </div>
  );
};

export default ManchetteWithSpaceTimeChartWrapper;
