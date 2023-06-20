import React from 'react';
import { Train } from 'reducers/osrdsimulation/types';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import DriverTrainScheduleContent from './DriverTrainScheduleContent';

export default function DriverTrainSchedule({ train }: { train: Train }) {
  const { data: trainSchedule } = osrdEditoastApi.useGetTrainScheduleByIdQuery({ id: train.id });
  const { data: rollingStock } = osrdEditoastApi.useGetRollingStockByIdQuery(
    {
      id: trainSchedule?.rolling_stock_id as number,
    },
    { skip: !trainSchedule || !trainSchedule.rolling_stock_id }
  );

  return rollingStock ? (
    <DriverTrainScheduleContent train={train} rollingStock={rollingStock} />
  ) : null;
}
