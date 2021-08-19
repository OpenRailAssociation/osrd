import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  formatStepsWithTime, mergeDatasArea,
} from 'applications/osrd/components/Helpers/ChartHelpers';

const createTrain = (keyValues, simulationTrains) => {
  // Prepare data
  const dataSimulation = simulationTrains.map((train, trainNumber) => {
    const dataSimulationTrain = {};
    dataSimulationTrain.name = train.name;
    dataSimulationTrain.trainNumber = trainNumber;
    dataSimulationTrain.headPosition = formatStepsWithTime(train, 'head_position');
    dataSimulationTrain.tailPosition = formatStepsWithTime(train, 'tail_position');
    dataSimulationTrain.endBlockOccupancy = formatStepsWithTime(train, 'end_block_occupancy');
    dataSimulationTrain.startBlockOccupancy = formatStepsWithTime(train, 'start_block_occupancy');
    dataSimulationTrain.areaBlock = mergeDatasArea(
      dataSimulationTrain.endBlockOccupancy, dataSimulationTrain.startBlockOccupancy, keyValues,
    );
    return dataSimulationTrain;
  });
  return dataSimulation;
};

export default function TrainDetails() {
  const { hoverPosition, selectedTrain, simulation } = useSelector((state) => state.osrdsimulation);
  const keyValues = ['time', 'value'];
  const [dataSimulation, setDataSimulation] = useState(undefined);

  const { t } = useTranslation(['simulation']);

  useEffect(() => {
    setDataSimulation(createTrain(keyValues, simulation.trains));
  }, [simulation, selectedTrain]);

  return dataSimulation !== undefined ? (
    <>
      { hoverPosition !== undefined
        && dataSimulation[selectedTrain].headPosition[hoverPosition] !== undefined
        ? (
          <div className="row">
            <div className="col-md-2">
              <div className="rounded px-2 h-100 py-1 mb-1 small bg-blue text-white">
                <div className="font-weight-bold mr-1">TÊTE</div>
                {Math.round(dataSimulation[selectedTrain].headPosition[hoverPosition].value) / 1000}
                km
              </div>
            </div>
            <div className="col-md-2">
              <div className="rounded px-2 h-100 py-1 mb-1 small bg-cyan text-white">
                <div className="font-weight-bold mr-1">QUEUE</div>
                {Math.round(dataSimulation[selectedTrain].tailPosition[hoverPosition].value) / 1000}
                km
              </div>
            </div>
            <div className="col-md-2">
              <div className="rounded px-2 h-100 py-1 mb-1 small bg-danger text-white">
                <div className="font-weight-bold mr-1">FREINAGE</div>
                {Math.round(
                  dataSimulation[selectedTrain].endBlockOccupancy[hoverPosition].value,
                ) / 1000}
                km
              </div>
            </div>
            <div className="col-md-2">
              <div className="rounded px-2 h-100 py-1 mb-1 small bg-orange text-white">
                <div className="font-weight-bold mr-1">BLOCK</div>
                {Math.round(
                  dataSimulation[selectedTrain].startBlockOccupancy[hoverPosition].value,
                ) / 1000}
                km
              </div>
            </div>
            <div className="col-md-2">
              <div className="rounded px-2 h-100 py-1 mb-1 small bg-secondary text-white">
                <div className="font-weight-bold mr-1">CANTON</div>
                {Math.round(
                  dataSimulation[selectedTrain].endBlockOccupancy[hoverPosition].value
                  - dataSimulation[selectedTrain].startBlockOccupancy[hoverPosition].value,
                ) / 1000}
                km
              </div>
            </div>
            <div className="col-md-2">
              <div className="rounded px-2 h-100 py-1 mb-1 small bg-pink text-white">
                <div className="font-weight-bold mr-1">VITESSE</div>
                {Math.round(simulation.trains[selectedTrain].steps[hoverPosition].speed * 3.6)}
                km/h
              </div>
            </div>
          </div>
        ) : null }
    </>
  ) : null;
}
