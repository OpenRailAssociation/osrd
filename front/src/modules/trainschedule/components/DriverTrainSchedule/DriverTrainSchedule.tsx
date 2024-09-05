import { useMemo } from 'react';

import type {
  PathPropertiesFormatted,
  SimulationResponseSuccess,
} from 'applications/operationalStudies/types';
import type { LightRollingStock, TrainScheduleBase } from 'common/api/osrdEditoastApi';
import { Loader } from 'common/Loaders';

import { BaseOrEco, type BaseOrEcoType } from './consts';
import DriverTrainScheduleHeader from './DriverTrainScheduleHeader';
import DriverTrainScheduleStopList from './DriverTrainScheduleStopList';
import type { OperationalPointWithTimeAndSpeed } from './types';

type DriverTrainScheduleProps = {
  train: TrainScheduleBase;
  simulatedTrain: SimulationResponseSuccess;
  pathProperties: PathPropertiesFormatted;
  rollingStock: LightRollingStock;
  operationalPoints: {
    base: OperationalPointWithTimeAndSpeed[];
    finalOutput: OperationalPointWithTimeAndSpeed[];
  };
  formattedOpPointsLoading: boolean;
  baseOrEco: BaseOrEcoType;
  setBaseOrEco: (baseOrEco: BaseOrEcoType) => void;
};

const DriverTrainSchedule = ({
  train,
  simulatedTrain,
  pathProperties,
  rollingStock,
  operationalPoints,
  formattedOpPointsLoading,
  baseOrEco,
  setBaseOrEco,
}: DriverTrainScheduleProps) => {
  const selectedTrainRegime = useMemo(
    () => (baseOrEco === BaseOrEco.eco ? simulatedTrain.final_output : simulatedTrain.base),
    [baseOrEco, simulatedTrain]
  );

  const operationPointsToUse = useMemo(
    () => (baseOrEco === BaseOrEco.eco ? operationalPoints.finalOutput : operationalPoints.base),
    [baseOrEco, operationalPoints]
  );

  return (
    <div className="simulation-driver-train-schedule">
      <DriverTrainScheduleHeader
        simulatedTrain={simulatedTrain}
        train={train}
        operationalPoints={operationPointsToUse}
        electrificationRanges={pathProperties.electrifications}
        rollingStock={rollingStock}
        baseOrEco={baseOrEco}
        setBaseOrEco={setBaseOrEco}
      />
      {formattedOpPointsLoading ? (
        // Prevent the screen from resizing during loading
        <div style={{ height: '50vh' }}>
          <Loader />
        </div>
      ) : (
        <DriverTrainScheduleStopList
          trainRegime={selectedTrainRegime}
          mrsp={simulatedTrain.mrsp}
          operationalPoints={operationPointsToUse}
        />
      )}
    </div>
  );
};

export default DriverTrainSchedule;
