import React, { useEffect, useState } from 'react';
import { get } from 'common/requests';
import PropTypes from 'prop-types';
import DriverTrainScheduleContent from './DriverTrainScheduleContent';

const TRAINSCHEDULE_URL = '/train_schedule';
const ROLLINGSTOCK_URL = '/rolling_stock';

export default function DriverTrainSchedule(props) {
  const { data } = props;
  const [rollingStockSelected, setRollingStockSelected] = useState(undefined);

  const getRollingStock = async () => {
    try {
      const trainScheduleDetails = await get(`${TRAINSCHEDULE_URL}/${data.id}/`);
      const rollingStock = await get(`${ROLLINGSTOCK_URL}/${trainScheduleDetails.rolling_stock}/`);
      setRollingStockSelected(rollingStock);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (data && !data.isStdcm) getRollingStock(); // Useless if new train is from stDcm (no persistance, 404 garanteed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return data && rollingStockSelected ? (
    <DriverTrainScheduleContent data={data} rollingStockSelected={rollingStockSelected} />
  ) : null;
}

DriverTrainSchedule.propTypes = {
  data: PropTypes.object,
};

DriverTrainSchedule.defaultProps = {
  data: undefined,
};
