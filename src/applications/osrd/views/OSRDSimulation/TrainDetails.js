import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
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
    dataSimulationTrain.headPosition = formatStepsWithTime(train, 'headPosition');
    dataSimulationTrain.tailPosition = formatStepsWithTime(train, 'tailPosition');
    dataSimulationTrain.brakingDistance = formatStepsWithTime(train, 'brakingDistance');
    dataSimulationTrain.currentBlocksection = formatStepsWithTime(train, 'currentBlocksection');
    dataSimulationTrain.areaBlock = mergeDatasArea(
      dataSimulationTrain.brakingDistance, dataSimulationTrain.currentBlocksection, keyValues,
    );
    return dataSimulationTrain;
  });
  return dataSimulation;
};

const TrainDetails = (props) => {
  const {
    hoverPosition, selectedTrain, simulation,
  } = props;
  const keyValues = ['time', 'value'];
  const [dataSimulation, setDataSimulation] = useState(undefined);

  const { t } = useTranslation(['simulation']);

  useEffect(() => {
    setDataSimulation(createTrain(keyValues, simulation.trains));
  }, [simulation, selectedTrain]);

  return dataSimulation !== undefined ? (
    <>
      <div className="mb-2">
        <span className="h2 mr-2">{t('simulation:train')}</span>
        <span className="font-weight-bold">{dataSimulation[selectedTrain].name}</span>
      </div>
      { hoverPosition !== undefined
        && dataSimulation[selectedTrain].headPosition[hoverPosition] !== undefined
        ? (
          <div className="row">
            <div className="col-sm-6">
              <div className="rounded font-weight-bold bg-secondary text-white p-2 mb-2">
                <i className="icons-clock mr-1" />
                {dataSimulation[selectedTrain].headPosition[hoverPosition].time.toLocaleTimeString('fr-FR')}
              </div>
            </div>
            <div className="col-sm-6">
              <div className={`rounded font-weight-bold text-white p-2 mb-2
                ${simulation.trains[selectedTrain].steps[hoverPosition].state === 'RUNNING' ? 'bg-success' : 'bg-danger'}
                `}
              >
                {simulation.trains[selectedTrain].steps[hoverPosition].state}
              </div>
            </div>
            <div className="col-sm-4">
              <div className="rounded p-2 mb-1 small bg-blue text-white">
                <div className="font-weight-bold mr-1">TÊTE</div>
                {Math.round(dataSimulation[selectedTrain].headPosition[hoverPosition].value) / 1000}
                km
              </div>
            </div>
            <div className="col-sm-4">
              <div className="rounded p-2 mb-1 small bg-cyan text-white">
                <div className="font-weight-bold mr-1">QUEUE</div>
                {Math.round(dataSimulation[selectedTrain].tailPosition[hoverPosition].value) / 1000}
                km
              </div>
            </div>
            <div className="col-sm-4">
              <div className="rounded p-2 mb-1 small bg-danger text-white">
                <div className="font-weight-bold mr-1">FREINAGE</div>
                {Math.round(
                  dataSimulation[selectedTrain].brakingDistance[hoverPosition].value,
                ) / 1000}
                km
              </div>
            </div>
            <div className="col-sm-4">
              <div className="rounded p-2 mb-1 small bg-orange text-white">
                <div className="font-weight-bold mr-1">BLOCK</div>
                {Math.round(
                  dataSimulation[selectedTrain].currentBlocksection[hoverPosition].value,
                ) / 1000}
                km
              </div>
            </div>
            <div className="col-sm-4">
              <div className="rounded p-2 mb-1 small bg-secondary text-white">
                <div className="font-weight-bold mr-1">CANTON</div>
                {Math.round(
                  dataSimulation[selectedTrain].brakingDistance[hoverPosition].value
                  - dataSimulation[selectedTrain].currentBlocksection[hoverPosition].value,
                ) / 1000}
                km
              </div>
            </div>
            <div className="col-sm-4">
              <div className="rounded p-2 mb-1 small bg-pink text-white">
                <div className="font-weight-bold mr-1">VITESSE</div>
                {Math.round(simulation.trains[selectedTrain].steps[hoverPosition].speed * 3.6)}
                km/h
              </div>
            </div>
          </div>
        ) : null }
    </>
  ) : null;
};

TrainDetails.propTypes = {
  simulation: PropTypes.object.isRequired,
  hoverPosition: PropTypes.number,
  selectedTrain: PropTypes.number.isRequired,
};
TrainDetails.defaultProps = {
  hoverPosition: undefined,
};

export default TrainDetails;
