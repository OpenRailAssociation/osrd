import React, { useEffect, useState } from 'react';
import { Train } from 'reducers/osrdsimulation/types';
import { LightRollingStock } from 'common/api/osrdEditoastApi';
import DriverTrainScheduleHeader from './DriverTrainScheduleHeader';
import DriverTrainScheduleStopList from './DriverTrainScheduleStopList';
import { BaseOrEco, BaseOrEcoType } from './DriverTrainScheduleTypes';

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
