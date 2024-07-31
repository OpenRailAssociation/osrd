import React, { useMemo } from 'react';

import type {
  PathPropertiesFormatted,
  SimulationResponseSuccess,
} from 'applications/operationalStudies/types';
import type { LightRollingStock, TrainScheduleBase } from 'common/api/osrdEditoastApi';
import { Loader } from 'common/Loaders';

import { BaseOrEco, type BaseOrEcoType } from './consts';
import DriverTrainScheduleHeaderV2 from './DriverTrainScheduleHeaderV2';
import DriverTrainScheduleStopListV2 from './DriverTrainScheduleStopListV2';
import type { OperationalPointWithTimeAndSpeed } from './types';

type DriverTrainScheduleV2Props = {
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

const DriverTrainScheduleV2 = ({
  train,
  simulatedTrain,
  pathProperties,
  rollingStock,
  operationalPoints,
  formattedOpPointsLoading,
  baseOrEco,
  setBaseOrEco,
}: DriverTrainScheduleV2Props) => {
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
      <DriverTrainScheduleHeaderV2
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
        <DriverTrainScheduleStopListV2
          trainRegime={selectedTrainRegime}
          mrsp={simulatedTrain.mrsp}
          operationalPoints={operationPointsToUse}
        />
      )}
    </div>
  );
};

export default DriverTrainScheduleV2;
