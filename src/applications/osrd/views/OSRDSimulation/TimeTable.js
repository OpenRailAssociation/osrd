import React from 'react';
import nextId from 'react-id-generator';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import { sec2time } from 'utils/timeManipulation';

const addSeconds = (time, seconds) => {
  const dateCalc = new Date(`2020-01-01T${time}`);
  dateCalc.setSeconds(dateCalc.getSeconds() + seconds);
  return dateCalc.toLocaleString('fr-FR').slice(-8);
};

const FormatStops = (props) => {
  const { t } = useTranslation(['simulation']);
  const { stop } = props;
  const departureTime = (stop.stop_time > 0) ? addSeconds(stop.time, stop.stop_time) : '';
  return (
    <tr>
      <td>
        <div className="cell-inner font-weight-bold">
          {stop.name === 'start' || stop.name === 'stop' ? t(`simulation:${stop.name}`) : stop.name}
        </div>
      </td>
      <td><div className="cell-inner">{sec2time(stop.time)}</div></td>
      <td><div className="cell-inner">{sec2time(departureTime)}</div></td>
      <td>
        <div className="cell-inner">
          {stop.stop_time > 0 ? `${stop.stop_time}s` : null}
        </div>
      </td>
    </tr>
  );
};

const TimeTable = (props) => {
  const { t } = useTranslation(['simulation']);
  const { data } = props;
  return (
    <>
      <div className="h2">{t('simulation:timetable')}</div>
      <div className="table-wrapper">
        <div className="table-scroller dragscroll">
          <table className="table table-hover table-shrink">
            <thead className="thead thead-light">
              <tr>
                <th scope="col"><div className="cell-inner">{t('simulation:stopPlace')}</div></th>
                <th scope="col"><div className="cell-inner">{t('simulation:stopTime')}</div></th>
                <th scope="col"><div className="cell-inner">{t('simulation:departureTime')}</div></th>
                <th scope="col"><div className="cell-inner">{t('simulation:stopStopTime')}</div></th>
              </tr>
            </thead>
            <tbody>
              {data.map((stop) => <FormatStops stop={stop} key={nextId()} />)}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

TimeTable.propTypes = {
  data: PropTypes.array.isRequired,
};
FormatStops.propTypes = {
  stop: PropTypes.object.isRequired,
};

export default TimeTable;
