import { Select } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';

import { StdcmStopTypes } from '../../types';

type StdcmStopTypeProps = {
  stopTypes: StdcmStopTypes;
  updatePathStepStopType: (stopType: StdcmStopTypes) => void;
};

const StdcmStopType = ({ stopTypes, updatePathStepStopType }: StdcmStopTypeProps) => {
  const { t } = useTranslation('stdcm');

  return (
    <Select<StdcmStopTypes>
      data-testid="stdcm-stop-type"
      label={t('trainPath.type')}
      id="type"
      value={stopTypes}
      onChange={(e) => {
        if (e) {
          updatePathStepStopType(e);
        }
      }}
      options={[StdcmStopTypes.WAYPOINT, StdcmStopTypes.DRIVER_SWITCH, StdcmStopTypes.SERVICE_STOP]}
      getOptionLabel={(option) => t(`trainPath.stopType.${option}`)}
      getOptionValue={(option) => option}
      narrow
    />
  );
};

export default StdcmStopType;
