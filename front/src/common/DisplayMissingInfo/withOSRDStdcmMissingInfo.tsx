import React, { ComponentType, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import {
  getInfraID,
  getRollingStockID,
  getSpeedLimitByTag,
  getTimetableID,
} from 'reducers/osrdconf/selectors';
import DisplayMissingInfo from './DisplayMissingInfo';

const withOSRDStdcmMissingInfo = <T extends {}>(Component: ComponentType<T>) => {
  return (hocProps: T) => {
    const { t } = useTranslation('missingInfo');

    const infra = useSelector(getInfraID);
    const timeTable = useSelector(getTimetableID);
    const rollingStock = useSelector(getRollingStockID);
    const speedLimitByTag = useSelector(getSpeedLimitByTag);

    const title = t('missingInfoTitle');

    const missingInfoList: string[] = [
      !infra ? t('missingInfra') : '',
      !timeTable ? t('missingTimeTable') : '',
      !rollingStock ? t('missingRollingStock') : '',
      !speedLimitByTag ? t('missingSpeedLimitByTag') : '',
    ];

    const [isCorrect, setIsCorrect] = useState<boolean>(false);

    useEffect(() => {
      if (infra && timeTable && rollingStock && speedLimitByTag) setIsCorrect(true);
    }, [infra, timeTable, rollingStock, speedLimitByTag]);

    return (
      !isCorrect && (
        <Component
          {...(hocProps as T)}
          title={title}
          missingInfoList={missingInfoList}
          isCorrect={isCorrect}
        />
      )
    );
  };
};

export default withOSRDStdcmMissingInfo(DisplayMissingInfo);
