import React from 'react';
import './TimeTable.scss';
import nextId from 'react-id-generator';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';

const addSeconds = (time, seconds) => {
  const dateCalc = new Date(`2020-01-01T${time}`);
  dateCalc.setSeconds(dateCalc.getSeconds() + seconds);
  return dateCalc.toLocaleString('fr-FR').slice(-8);
};

const FormatStops = (props) => {
  const { t } = useTranslation();
  const { stop } = props;
  const departureTime = (stop.stop_time > 0) ? addSeconds(stop.time, stop.stop_time) : '';
  return (
    <div className="row osrd-simulation-timetable-line no-gutters">
      <div className={`col-4 ${stop.name === 'null' ? 'text-muted' : 'font-weight-bold'}`}>
        <span className="osrd-simulation-timetable-elem">
          {stop.name === 'start' || stop.name === 'stop' ? t(`osrd.simulation.${stop.name}`) : stop.name}
        </span>
      </div>
      <div className="col-3">
        <span className="osrd-simulation-timetable-elem">
          {stop.time}
        </span>
      </div>
      <div className="col-3">
        {departureTime !== '' ? (
          <span className="osrd-simulation-timetable-elem">
            {departureTime}
          </span>
        ) : null}
      </div>
      <div className="col-2">
        {stop.stop_time > 0 ? (
          <span className="osrd-simulation-timetable-elem">
            {`${stop.stop_time}s`}
          </span>
        ) : null}
      </div>
    </div>
  );
};

const TimeTable = (props) => {
  const { t } = useTranslation();
  const { data } = props;
  return (
    <>
      <div className="h2">{t('osrd.simulation.timetable')}</div>
      <div className="row">
        <div className="col-4 small text-uppercase text-muted">{t('osrd.simulation.stopPlace')}</div>
        <div className="col-3 small text-uppercase text-muted">{t('osrd.simulation.stopTime')}</div>
        <div className="col-3 small text-uppercase text-muted">{t('osrd.simulation.departureTime')}</div>
        <div className="col-2 small text-uppercase text-muted">{t('osrd.simulation.stopStopTime')}</div>
      </div>
      {data.map((stop) => <FormatStops stop={stop} key={nextId()} />)}
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
