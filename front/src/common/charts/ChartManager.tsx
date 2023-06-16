import React, { ReactNode, useEffect, useState } from 'react';
import { ReactElement } from 'react-markdown/lib/react-markdown';
import prepareData, {
  GevPreparedata,
} from 'applications/operationalStudies/components/SimulationResults/SpeedSpaceChart/prepareData';
import { Train } from 'reducers/osrdsimulation/types';

type ChartManagerProps = {
  children: ReactElement | JSX.Element | [ReactElement | JSX.Element];
  selectedTrain: Train;
};

export type GraphProps = {
  timePosition?: string;
  selectedTrainSimulation?: GevPreparedata;
  horizontalZoom?: number;
  positionX?: number;
};

export default function ChartManager({ children, selectedTrain }: ChartManagerProps) {
  const [timePosition, setTimePosition] = useState<string | undefined>(undefined);
  const [horizontalZoom, sethorizontalZoom] = useState<number>(1);
  const [positionX, setPositionX] = useState<number | undefined>(undefined);
  const [selectedTrainSimulation, setSelectedTrainSimulation] = useState<
    GevPreparedata | undefined
  >(undefined);

  useEffect(() => {
    if (selectedTrain) {
      const trainSimulationData = prepareData(selectedTrain);
      setSelectedTrainSimulation(trainSimulationData);
    }
  }, [selectedTrain]);

  if (!children) return null;

  return (
    <div>
      {/* Render child graphs */}
      {React.Children.map(children as [React.ReactElement], (child) =>
        React.cloneElement(child, {
          horizontalZoom,
          positionX,
          timePosition,
          selectedTrainSimulation,
          setTimePosition,
          sethorizontalZoom,
          setPositionX,
        })
      )}
    </div>
  );
}
