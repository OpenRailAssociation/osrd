import React, { useEffect, useState } from 'react';

import type { LightRollingStock } from 'common/api/osrdEditoastApi';
import type { Train } from 'reducers/osrdsimulation/types';

import DriverTrainScheduleHeader from './DriverTrainScheduleHeader';
import DriverTrainScheduleStopList from './DriverTrainScheduleStopList';
import { BaseOrEco, type BaseOrEcoType } from './DriverTrainScheduleTypes';

export default function DriverTrainSchedule({
  train,
  rollingStock,
}: {
  train: Train;
  rollingStock: LightRollingStock;
}) {
  const [baseOrEco, setBaseOrEco] = useState<BaseOrEcoType>(BaseOrEco.base);

  useEffect(() => {
    if (baseOrEco === BaseOrEco.eco && !train[baseOrEco]) setBaseOrEco(BaseOrEco.base);
  }, [train]);

  return (
    <div className="simulation-driver-train-schedule">
      <DriverTrainScheduleHeader
        train={train}
        rollingStock={rollingStock}
        baseOrEco={baseOrEco}
        setBaseOrEco={setBaseOrEco}
      />
      <DriverTrainScheduleStopList train={train} baseOrEco={baseOrEco} />
    </div>
  );
}
