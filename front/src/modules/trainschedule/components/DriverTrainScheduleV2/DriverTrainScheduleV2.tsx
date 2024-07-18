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
import { formatOperationalPoints, isEco } from './utils';
import { BaseOrEco, type BaseOrEcoType } from '../DriverTrainSchedule/consts';

type DriverTrainScheduleV2Props = {
  train: TrainScheduleBase;
  simulatedTrain: SimulationResponseSuccess;
  pathProperties: PathPropertiesFormatted;
  rollingStock: LightRollingStock;
  infraId: number;
};

const DriverTrainScheduleV2 = ({
  train,
  simulatedTrain,
  pathProperties,
  rollingStock,
  infraId,
}: DriverTrainScheduleV2Props) => {
  const [baseOrEco, setBaseOrEco] = useState<BaseOrEcoType>(
    isEco(train) ? BaseOrEco.eco : BaseOrEco.base
  );
  const [operationalPoints, setOperationalPoints] = useState<OperationalPointWithTimeAndSpeed[]>(
    []
  );
  const [loading, setLoading] = useState(false);

  const selectedTrainRegime = useMemo(
    () => (baseOrEco === BaseOrEco.eco ? simulatedTrain.final_output : simulatedTrain.base),
    [baseOrEco, simulatedTrain]
  );

  useEffect(() => {
    const fetchOperationalPoints = async () => {
      setLoading(true);
      const formattedOperationalPoints = await formatOperationalPoints(
        pathProperties.operationalPoints,
        selectedTrainRegime,
        train,
        infraId
      );
      setOperationalPoints(formattedOperationalPoints);
      setLoading(false);
    };
    fetchOperationalPoints();
  }, [pathProperties, simulatedTrain, train, infraId, baseOrEco]);

  useEffect(() => {
    setBaseOrEco(isEco(train) ? BaseOrEco.eco : BaseOrEco.base);
  }, [simulatedTrain]);

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
          {loading ? (
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
