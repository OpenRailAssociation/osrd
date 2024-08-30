import { Select } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';

import type { StdcmStopTypes } from '../types';

type StdcmStopTypeProps = {
  stopTypes: StdcmStopTypes;
  updatePathStepStopType: (stopType: StdcmStopTypes) => void;
};

const StdcmStopType = ({ stopTypes, updatePathStepStopType }: StdcmStopTypeProps) => {
  const { t } = useTranslation('stdcm');

  return (
    <div className="stdcm-v2-via-stop-for selector">
      <Select
        label={t('trainPath.type')}
        id="type"
        value={stopTypes}
        onChange={(e) => {
          if (e) {
            updatePathStepStopType(e as StdcmStopTypes);
          }
        }}
        options={['passageTime', 'driverSwitch', 'serviceStop']}
        getOptionLabel={(option) => t(`trainPath.stopType.${option}`)}
        getOptionValue={(option) => option}
      />
    </div>
  );
};

export default StdcmStopType;
