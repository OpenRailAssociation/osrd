import React from 'react';
import { Train } from 'reducers/osrdsimulation/types';
import { osrdMiddlewareApi } from 'common/api/osrdMiddlewareApi';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import DriverTrainScheduleContent from './DriverTrainScheduleContent';

export default function DriverTrainSchedule({ train }: { train: Train }) {
  const { data: trainSchedule } = osrdMiddlewareApi.useGetTrainScheduleByIdQuery({ id: train.id });
  const { data: rollingStock } = osrdEditoastApi.useGetRollingStockByIdQuery(
    {
      id: trainSchedule?.rolling_stock as number,
    },
    { skip: !trainSchedule || !trainSchedule.rolling_stock }
  );

  return rollingStock ? (
    <DriverTrainScheduleContent train={train} rollingStock={rollingStock} />
  ) : null;
}
