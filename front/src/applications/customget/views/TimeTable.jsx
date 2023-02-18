import React from 'react';
import nextId from 'react-id-generator';
import { sec2time } from 'utils/timeManipulation';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import { BsArrowRightShort } from 'react-icons/bs';
import signalIcon from 'assets/pictures/layersicons/layer_signal_open.svg';
import stopIcon from 'assets/pictures/layersicons/ops.svg';

function type2icon(type) {
  switch (type) {
    case 'stop':
      return <img src={stopIcon} alt="stop icon" width="24" />;
    case 'signal':
      return <img src={signalIcon} alt="signal icon" width="24" />;
    default:
      return type;
  }
}

function formatStops(stop, idx) {
  return (
    <tr key={nextId()} className={`${stop.duration > 0 ? 'font-weight-bold' : ''}`}>
      <td>
        <div className="cell-inner">{idx}</div>
      </td>
      <td>
        <div className="cell-inner">{Math.round(stop.position / 100) / 10}</div>
      </td>
      <td>
        <div className="cell-inner text-center">{type2icon(stop.type)}</div>
      </td>
      <td>
        <div className="cell-inner">{stop.name || 'Unknown'}</div>
      </td>
      <td>
        <div className="cell-inner">{sec2time(stop.time)}</div>
      </td>
      <td>
        <div className="cell-inner">{stop.duration > 0 && sec2time(stop.time + stop.duration)}</div>
      </td>
      <td>
        <div className="cell-inner">{stop.duration > 0 ? `${stop.duration}s` : null}</div>
      </td>
    </tr>
  );
}

export default function TimeTable() {
  const { t } = useTranslation(['simulation']);
  const { departureArrivalTimes, selectedTrain } = useSelector((state) => state.osrdsimulation);
  const simulation = useSelector((state) => state.osrdsimulation.simulation.present);
  const data = simulation.trains[selectedTrain].base.stops;

  return (
    <>
      <div
        className="train-name-timetable p-1 d-flex align-items-center mb-2"
        style={{ 'background-color': simulation.trains[selectedTrain].color }}
      >
        <div className="mr-2">
          <span className="ml-2">{departureArrivalTimes[selectedTrain].name}</span>
        </div>
        <div className="small mr-1">{sec2time(departureArrivalTimes[selectedTrain].departure)}</div>
        <span className="ml-1 mr-2">
          <BsArrowRightShort />
        </span>
        <div className="small">{sec2time(departureArrivalTimes[selectedTrain].arrival)}</div>
      </div>
      <div className="table-wrapper" style={{ maxHeight: '40vh', overflow: 'auto' }}>
        <div className="table-scroller dragscroll">
          <table className="table table-hover table-shrink table-striped timetable">
            <thead className="thead thead-light">
              <tr>
                <th scope="col">n°</th>
                <th scope="col">
                  <div className="cell-inner">KM</div>
                </th>
                <th scope="col">
                  <div className="cell-inner">TYPE</div>
                </th>
                <th scope="col">
                  <div className="cell-inner">{t('simulation:stopPlace')}</div>
                </th>
                <th scope="col">
                  <div className="cell-inner">{t('simulation:stopTime')}</div>
                </th>
                <th scope="col">
                  <div className="cell-inner">{t('simulation:departureTime')}</div>
                </th>
                <th scope="col">
                  <div className="cell-inner">{t('simulation:stopStopTime')}</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((stop, idx) => formatStops(stop, idx, simulation.trains[selectedTrain]))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
