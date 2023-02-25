import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import RollingStockSelector from 'common/RollingStockSelector/RollingStockSelector';
import PropTypes from 'prop-types';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import MemoStationSelector from 'applications/operationalStudies/components/ImportTrainSchedule/ImportTrainScheduleStationSelector';
import { setFailure } from 'reducers/main';
import { useDispatch } from 'react-redux';
import StationCard from 'common/StationCard';

function dateOfToday() {
  const date = new Date();
  return date.toJSON().substring(0, 10);
}

export default function ImportTrainScheduleConfig(props) {
  const { setConfig } = props;
  const { t } = useTranslation(['operationalStudies/importTrainSchedule']);
  const [from, setFrom] = useState();
  const [fromSearchString, setFromSearchString] = useState('');
  const [to, setTo] = useState();
  const [toSearchString, setToSearchString] = useState('');
  const [date, setDate] = useState(dateOfToday());
  const [startTime, setStartTime] = useState('00:00');
  const [endTime, setEndTime] = useState('23:59');
  const dispatch = useDispatch();

  function defineConfig() {
    let error = false;
    if (!from) {
      dispatch(
        setFailure({ name: t('errorMessages.error'), message: t('errorMessages.errorNoFrom') })
      );
      error = true;
    }
    if (!to) {
      dispatch(
        setFailure({ name: t('errorMessages.error'), message: t('errorMessages.errorNoTo') })
      );
      error = true;
    }
    if (!date) {
      dispatch(
        setFailure({ name: t('errorMessages.error'), message: t('errorMessages.errorNoDate') })
      );
      error = true;
    }
    if (JSON.stringify(from) === JSON.stringify(to)) {
      dispatch(
        setFailure({ name: t('errorMessages.error'), message: t('errorMessages.errorSameFromTo') })
      );
      error = true;
    }

    if (!error) {
      setConfig({
        from,
        to,
        date,
        startTime,
        endTime,
      });
    }
  }

  function importFile() {
    return null;
  }

  return (
    <>
      <div className="row no-gutters">
        <div className="col-lg-6 station-selector sm-gutters">
          <div className="osrd-config-item mb-2">
            <div className="osrd-config-item-container osrd-config-item-from">
              <h2>{t('from')}</h2>
              {from ? (
                <div
                  className="result-station-selected"
                  onClick={() => setFrom(undefined)}
                  role="button"
                  tabIndex={0}
                >
                  <StationCard station={from} fixedHeight />
                </div>
              ) : (
                <MemoStationSelector
                  id="fromSearch"
                  onSelect={setFrom}
                  term={fromSearchString}
                  setTerm={setFromSearchString}
                />
              )}
            </div>
          </div>
        </div>
        <div className="col-lg-6 station-selector sm-gutters">
          <div className="osrd-config-item mb-2">
            <div className="osrd-config-item-container osrd-config-item-to">
              <h2>{t('to')}</h2>
              {to ? (
                <div
                  className="result-station-selected"
                  onClick={() => setTo(undefined)}
                  role="button"
                  tabIndex={0}
                >
                  <StationCard station={to} fixedHeight />
                </div>
              ) : (
                <MemoStationSelector
                  id="toSearch"
                  onSelect={setTo}
                  term={toSearchString}
                  setTerm={setToSearchString}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="row no-gutters">
        <div className="col-lg-6 sm-gutters">
          <RollingStockSelector />
        </div>
        <div className="col-lg-5 col-9 sm-gutters">
          <div className="osrd-config-item">
            <div className="osrd-config-item-container osrd-config-item-datetime">
              <h2>{t('datetime')}</h2>
              <div className="mb-2">
                <InputSNCF
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  sm
                  noMargin
                  step={0}
                  unit={t('date')}
                />
              </div>
              <div className="row no-gutters">
                <span className="col-6 sm-gutters">
                  <InputSNCF
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    sm
                    noMargin
                    step={0}
                    unit={t('startTime')}
                  />
                </span>
                <span className="col-6 sm-gutters">
                  <InputSNCF
                    id="endTime"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    sm
                    noMargin
                    step={0}
                    unit={t('endTime')}
                  />
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-1 col-3 d-flex flex-column sm-gutters pb-lg-2">
          <button
            type="button"
            className="btn btn-sm btn-primary btn-block h-100"
            onClick={defineConfig}
          >
            <i className="icons-search" />
          </button>
          <button
            type="button"
            className="btn btn-sm btn-secondary btn-block h-100"
            onClick={importFile}
          >
            <i className="icons-download" />
          </button>
        </div>
      </div>
    </>
  );
}

ImportTrainScheduleConfig.propTypes = {
  setConfig: PropTypes.func.isRequired,
};
