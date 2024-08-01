import React, { useEffect, useMemo } from 'react';

import { isNil } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import OriginIcon from 'assets/pictures/stdcmV2/start.svg';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useOsrdConfSelectors, useOsrdConfActions } from 'common/osrdContext';
import type { StdcmConfSliceActions } from 'reducers/osrdconf/stdcmConf';
import type { PathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { replaceElementAtIndex } from 'utils/array';
import { dateTimeFormatting } from 'utils/date';

import StdcmCard from './StdcmCard';
import StdcmOperationalPoint from './StdcmOperationalPoint';
import type { StdcmConfigCardProps } from '../types';

const StdcmOrigin = ({ setCurrentSimulationInputs, disabled = false }: StdcmConfigCardProps) => {
  const { t } = useTranslation('stdcm');
  const dispatch = useAppDispatch();
  const { getOriginV2, getOriginDate, getOriginTime, getSearchDatetimeWindow } =
    useOsrdConfSelectors();
  const { updateOriginV2, updateOriginDate, updateOriginTime } =
    useOsrdConfActions() as StdcmConfSliceActions;
  const origin = useSelector(getOriginV2);
  const originDate = useSelector(getOriginDate);
  const originTime = useSelector(getOriginTime);
  const searchDatetimeWindow = useSelector(getSearchDatetimeWindow);

  const updateOriginV2Point = (pathStep: PathStep | null) => {
    dispatch(updateOriginV2(pathStep));
  };

  useEffect(() => {
    setCurrentSimulationInputs((prevState) => ({
      ...prevState,
      pathSteps: replaceElementAtIndex(prevState?.pathSteps, 0, origin),
      departureDate: originDate,
      departureTime: originTime,
    }));
  }, [origin, originDate, originTime]);

  const onOriginDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(updateOriginDate(e.target.value));
  };

  const onOriginTimeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(updateOriginTime(e.target.value));
  };

  const error = useMemo(() => {
    if (originDate && searchDatetimeWindow) {
      const datetime = new Date(`${originDate} ${originTime || '00:00'}`);
      if (datetime < searchDatetimeWindow.begin || searchDatetimeWindow.end < datetime) {
        return t('datetimeOutsideWindow', {
          low: dateTimeFormatting(searchDatetimeWindow.begin),
          high: dateTimeFormatting(searchDatetimeWindow.end),
        });
      }
    }
    return null;
  }, [originDate, originTime, searchDatetimeWindow]);

  return (
    <StdcmCard
      name={t('trainPath.origin')}
      title={<img src={OriginIcon} alt="origin" />}
      disabled={disabled}
      hasTip
    >
      <div className="stdcm-v2-origin">
        <StdcmOperationalPoint
          updatePoint={updateOriginV2Point}
          point={origin}
          disabled={disabled}
        />
        <div className="stdcm-v2-origin__parameters row">
          <div className="col-6">
            <InputSNCF
              id="dateOrigin"
              label={t('trainPath.date')}
              type="date"
              name="dateOrigin"
              onChange={onOriginDateInputChange}
              isInvalid={!isNil(error)}
              value={originDate}
              disabled={disabled}
            />
          </div>
          <div className="col-6">
            <InputSNCF
              type="time"
              label={t('trainPath.time')}
              id="originTime"
              onChange={onOriginTimeInputChange}
              isInvalid={!isNil(error)}
              value={originTime}
              disabled={disabled}
            />
          </div>
          {error && (
            <div className="col-12 text-danger text-center">
              <p>{error}</p>
            </div>
          )}
        </div>
      </div>
    </StdcmCard>
  );
};

export default StdcmOrigin;
