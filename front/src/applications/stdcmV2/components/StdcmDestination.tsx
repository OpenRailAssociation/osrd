import React from 'react';

import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useOsrdConfSelectors, useOsrdConfActions } from 'common/osrdContext';
import type { StdcmConfSliceActions } from 'reducers/osrdconf/stdcmConf';

import StdcmCard from './StdcmCard';
import StdcmOperationalPoint from './StdcmOperationalPoint';

const StdcmDestination = ({ disabled = false }: { disabled?: boolean }) => {
  const { t } = useTranslation('stdcm');
  const { getDestinationV2 } = useOsrdConfSelectors();
  const { updateDestinationV2 } = useOsrdConfActions() as StdcmConfSliceActions;
  const destination = useSelector(getDestinationV2);
  return (
    <StdcmCard name={t('trainPath.destination')} disabled={disabled}>
      <div className="stdcm-v2-destination">
        <StdcmOperationalPoint
          updatePoint={updateDestinationV2}
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
