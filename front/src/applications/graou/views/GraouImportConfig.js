import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import StationSelector, { formatStation } from 'applications/graou/components/StationSelector';
import { setFailure } from 'reducers/main';
import { useDispatch } from 'react-redux';

function dateOfToday() {
  const date = new Date();
  return date.toJSON().substring(0, 10);
}

export default function GraouImportConfig(props) {
  const { setConfig } = props;
  const { t } = useTranslation(['graou']);
  const [from, setFrom] = useState();
  const [fromSearchString, setFromSearchString] = useState('');
  const [to, setTo] = useState();
  const [toSearchString, setToSearchString] = useState('');
  const [date, setDate] = useState(dateOfToday());
  const [startTime, setStartTime] = useState('00:00');
  const [endTime, setEndTime] = useState('23:59');
  const dispatch = useDispatch();

  function defineConfig() {
    if (!from) {
      dispatch(
        setFailure({ name: t('errorMessages.error'), message: t('errorMessages.errorNoFrom') })
      );
    }
    if (!to) {
      dispatch(
        setFailure({ name: t('errorMessages.error'), message: t('errorMessages.errorNoTo') })
      );
    }
    if (!date) {
      dispatch(
        setFailure({ name: t('errorMessages.error'), message: t('errorMessages.errorNoDate') })
      );
    }
    if (from && to && date) {
      setConfig({
        from,
        to,
        date,
        startTime,
        endTime,
      });
    }
  }

  return (
    <div className="row">
      <div className="col-lg-4">
        <div className="osrd-config-item mb-2">
          <div className="osrd-config-item-container">
            <h2>{t('from')}</h2>
            {from ? (
              <div
                className="result-station-selected"
                onClick={() => setFrom(undefined)}
                role="button"
                tabIndex={0}
              >
                {formatStation(from)}
              </div>
            ) : (
              <StationSelector
                id="fromSearch"
                onSelect={setFrom}
                term={fromSearchString}
                setTerm={setFromSearchString}
              />
            )}
          </div>
        </div>
      </div>
      <div className="col-lg-4">
        <div className="osrd-config-item mb-2">
          <div className="osrd-config-item-container">
            <h2>{t('to')}</h2>
            {to ? (
              <div
                className="result-station-selected"
                onClick={() => setTo(undefined)}
                role="button"
                tabIndex={0}
              >
                {formatStation(to)}
              </div>
            ) : (
              <StationSelector
                id="toSearch"
                onSelect={setTo}
                term={toSearchString}
                setTerm={setToSearchString}
              />
            )}
          </div>
        </div>
      </div>
      <div className="col-lg-4">
        <div className="osrd-config-item mb-2">
          <div className="osrd-config-item-container">
            <h2>{t('datetime')}</h2>
            <div className="row no-gutters">
              <div className="col-9">
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
                <div className="d-flex">
                  <span className="flex-fill mr-1">
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
                  <span className="flex-fill ml-1">
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
              <div className="col-3 pl-2">
                <button
                  type="button"
                  className="btn btn-primary btn-block h-100"
                  onClick={defineConfig}
                >
                  <i className="icons-search" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

GraouImportConfig.propTypes = {
  setConfig: PropTypes.func.isRequired,
};
