import React, { useEffect } from 'react';

import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import DestinationIcon from 'assets/pictures/stdcmV2/destination.svg';
import { useOsrdConfSelectors, useOsrdConfActions } from 'common/osrdContext';
import type { StdcmConfSliceActions } from 'reducers/osrdconf/stdcmConf';
import type { PathStep } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';

import StdcmCard from './StdcmCard';
import StdcmOperationalPoint from './StdcmOperationalPoint';
import type { StdcmConfigCardProps } from '../types';

const StdcmDestination = ({
  setCurrentSimulationInputs,
  disabled = false,
}: StdcmConfigCardProps) => {
  const { t } = useTranslation('stdcm');
  const dispatch = useAppDispatch();
  const { getDestinationV2 } = useOsrdConfSelectors();
  const { updateDestinationV2 } = useOsrdConfActions() as StdcmConfSliceActions;
  const destination = useSelector(getDestinationV2);

  const updateDestinationV2Point = (pathStep: PathStep | null) => {
    dispatch(updateDestinationV2(pathStep));
  };

  useEffect(() => {
    setCurrentSimulationInputs((prevState) => ({
      ...prevState,
      destination,
    }));
  }, [destination]);

  return (
    <StdcmCard
      name={t('trainPath.destination')}
      title={<img src={DestinationIcon} alt="destination" />}
      disabled={disabled}
    >
      <div className="stdcm-v2-destination">
        <StdcmOperationalPoint
          updatePoint={updateDestinationV2Point}
          point={destination}
          disabled={disabled}
        />
        {/* TODO: enable this select when the feature is implemented in the backend */}
        {/* <div>
          <select id="destination" name="destination" disabled>
            <option value="asSoonAsPossible">{t('trainPath.asSoonAsPossible')}</option>
          </select>
        </div> */}
      </div>
    </StdcmCard>
  );
};

export default StdcmDestination;
