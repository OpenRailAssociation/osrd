import React, { useEffect, useMemo, useState } from 'react';

import type {
  PathPropertiesFormatted,
  SimulationResponseSuccess,
} from 'applications/operationalStudies/types';
import type { LightRollingStock, TrainScheduleBase } from 'common/api/osrdEditoastApi';
import { Loader } from 'common/Loaders';

import DriverTrainScheduleHeaderV2 from './DriverTrainScheduleHeaderV2';
import DriverTrainScheduleStopListV2 from './DriverTrainScheduleStopListV2';
import type { OperationalPointWithTimeAndSpeed } from './types';
import { isEco } from './utils';
import { BaseOrEco, type BaseOrEcoType } from '../DriverTrainSchedule/consts';

type DriverTrainScheduleV2Props = {
  train: TrainScheduleBase;
  simulatedTrain: SimulationResponseSuccess;
  pathProperties: PathPropertiesFormatted;
  rollingStock: LightRollingStock;
  operationalPoints: OperationalPointWithTimeAndSpeed[];
  formattedOpPointsLoading: boolean;
};

const DriverTrainScheduleV2 = ({
  train,
  simulatedTrain,
  pathProperties,
  rollingStock,
  operationalPoints,
  formattedOpPointsLoading,
}: DriverTrainScheduleV2Props) => {
  const [baseOrEco, setBaseOrEco] = useState<BaseOrEcoType>(
    isEco(train) ? BaseOrEco.eco : BaseOrEco.base
  );

  useEffect(() => {
    setBaseOrEco(isEco(train) ? BaseOrEco.eco : BaseOrEco.base);
  }, [simulatedTrain]);

  const selectedTrainRegime = useMemo(
    () => (baseOrEco === BaseOrEco.eco ? simulatedTrain.final_output : simulatedTrain.base),
    [baseOrEco, simulatedTrain]
  );

  return (
    <div className="simulation-driver-train-schedule">
      {operationalPoints.length > 0 && (
        <>
          <DriverTrainScheduleHeaderV2
            simulatedTrain={simulatedTrain}
            train={train}
            operationalPoints={operationalPoints}
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
              operationalPoints={operationalPoints}
            />
          )}
        </>
      )}
    </div>
  );
};

export default DriverTrainScheduleV2;
