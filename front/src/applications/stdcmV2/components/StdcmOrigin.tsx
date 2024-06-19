import React, { useEffect } from 'react';

import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import OriginIcon from 'assets/pictures/stdcmV2/start.svg';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useOsrdConfSelectors, useOsrdConfActions } from 'common/osrdContext';
import type { StdcmConfSliceActions } from 'reducers/osrdconf/stdcmConf';
import type { PathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';

import StdcmCard from './StdcmCard';
import StdcmOperationalPoint from './StdcmOperationalPoint';
import type { StdcmConfigCardProps } from '../types';

const StdcmOrigin = ({ setCurrentSimulationInputs, disabled = false }: StdcmConfigCardProps) => {
  const { t } = useTranslation('stdcm');
  const dispatch = useAppDispatch();
  const { getOriginV2, getOriginDate, getOriginTime } = useOsrdConfSelectors();
  const { updateOriginV2, updateOriginDate, updateOriginTime } =
    useOsrdConfActions() as StdcmConfSliceActions;
  const origin = useSelector(getOriginV2);
  const originDate = useSelector(getOriginDate);
  const originTime = useSelector(getOriginTime);

  const updateOriginV2Point = (pathStep: PathStep | null) => {
    dispatch(updateOriginV2(pathStep));
  };

  useEffect(() => {
    setCurrentSimulationInputs((prevState) => ({
      ...prevState,
      origin,
      departureDate: originDate,
      departureTime: originTime,
    }));
  }, [origin, originDate, originTime]);

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
        <div className="stdcm-v2-origin__parameters d-flex">
          <div className="col-6">
            <InputSNCF
              id="dateOrigin"
              label={t('trainPath.date')}
              type="date"
              name="dateOrigin"
              onChange={(e) => dispatch(updateOriginDate(e.target.value))}
              value={originDate}
              disabled={disabled}
            />
          </div>
          <div className="col-6">
            <InputSNCF
              type="time"
              label={t('trainPath.time')}
              id="originTime"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                dispatch(updateOriginTime(e.target.value))
              }
              value={originTime}
              disabled={disabled}
            />
          </div>
        </div>
      </div>
    </StdcmCard>
  );
};

export default StdcmOrigin;
