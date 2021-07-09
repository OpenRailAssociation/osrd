import React from 'react';
import nextId from 'react-id-generator';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { sec2time } from 'utils/timeManipulation';

function formatStops(stop) {
  const departureTime = (stop.stop_time > 0) ? stop.time + stop.stop_time : '';
  return (
    <tr key={nextId()}>
      <td>
        <div className="cell-inner font-weight-bold">
          {stop.name}
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
}

export default function TimeTable() {
  const { t } = useTranslation(['simulation']);
  const { selectedTrain, simulation } = useSelector((state) => state.osrdsimulation);
  const data = simulation.trains[selectedTrain].stops;

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
              {data.map((stop) => formatStops(stop))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
