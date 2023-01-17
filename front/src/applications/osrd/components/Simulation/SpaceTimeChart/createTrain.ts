import { Dispatch } from 'redux';
import { TFunction, Namespace } from 'react-i18next';

import {
  formatRouteAspects,
  formatSignalAspects,
  formatStepsWithTime,
  formatStepsWithTimeMulti,
  mergeDatasArea,
} from 'applications/osrd/components/Helpers/ChartHelpers';

import { setFailure } from 'reducers/main';
import { Train, SimulationTrain } from 'reducers/osrdsimulation/types';

/**
 * Will do some formating & computation to get a trains to be displayed. Stored then with currentSimulation splitted reducer
 * @param {*} dispatch react action dispatcher
 * @param {*} keyValues what do we compare (times vs position vs speed vs slope etc...)
 * @param {*} simulationTrains simulation raw data
 * @param {*} t translation middle
 * @returns
 */
export default function createTrain(
  dispatch: Dispatch,
  keyValues: string[],
  simulationTrains: Train[],
  t: TFunction<Namespace<string>, undefined>
): SimulationTrain[] {
  // Prepare data
  const dataSimulation = simulationTrains.map((train: Train, trainNumber: number) => {


    const dataSimulationTrain: SimulationTrain = {
      id: train.id,
      isStdcm: train.isStdcm,
      name: train.name,
      trainNumber,
      headPosition: formatStepsWithTimeMulti(train.base.head_positions),
      tailPosition: formatStepsWithTimeMulti(train.base.tail_positions),
      routeAspects: formatRouteAspects(train.base.route_aspects),
      signalAspects: formatSignalAspects(train.base.signal_aspects),
      speed: formatStepsWithTime(train.base.speeds),
    };

    /* MARECO */
    if (train.eco && !train.eco.error) {
      return {
        ...dataSimulationTrain,
        eco_headPosition: formatStepsWithTimeMulti(train.eco.head_positions),
        eco_tailPosition: formatStepsWithTimeMulti(train.eco.tail_positions),
        eco_routeAspects: formatRouteAspects(train.eco.route_aspects),
        eco_signalAspects: formatSignalAspects(train.eco.signal_aspects),
        eco_areaBlock: mergeDatasArea<Date | null>(
          dataSimulationTrain.eco_tailPosition,
          dataSimulationTrain.eco_headPosition,
          keyValues
        ),
        eco_speed: formatStepsWithTime(train.eco.speeds),
      };
    }
    if (train.eco && train.eco.error && dispatch && t) {
      // Tbe removed, useless
      dispatch(
        setFailure({
          name: t('errors.eco'),
          message: train.eco.error,
        })
      );
    }
    return dataSimulationTrain;
  });
  return dataSimulation;
}
