import React, { useEffect, useState } from 'react';
import { Train } from 'reducers/osrdsimulation/types';
import { osrdMiddlewareApi } from 'common/api/osrdMiddlewareApi';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import DriverTrainScheduleHeader from './DriverTrainScheduleHeader';
import DriverTrainScheduleStopList from './DriverTrainScheduleStopList';
import { BaseOrEco, BaseOrEcoType } from './DriverTrainScheduleTypes';

export default function DriverTrainSchedule({ train }: { train: Train }) {
  const { data: trainSchedule } = osrdMiddlewareApi.useGetTrainScheduleByIdQuery({ id: train.id });
  const { data: rollingStock } = osrdEditoastApi.useGetRollingStockByIdQuery(
    {
      id: trainSchedule?.rolling_stock as number,
    },
    { skip: !trainSchedule || !trainSchedule.rolling_stock }
  );
  const [baseOrEco, setBaseOrEco] = useState<BaseOrEcoType>(BaseOrEco.base);

  useEffect(() => {
    if (baseOrEco === BaseOrEco.eco && !train[baseOrEco]) setBaseOrEco(BaseOrEco.base);
  }, [train]);

  return rollingStock ? (
    <div className="container-drivertrainschedule">
      <DriverTrainScheduleHeader
        train={train}
        rollingStock={rollingStock}
        baseOrEco={baseOrEco}
        setBaseOrEco={setBaseOrEco}
      />
      <DriverTrainScheduleStopList train={train} baseOrEco={baseOrEco} />
    </div>
  ) : null;
}
