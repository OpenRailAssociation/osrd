import React, { ComponentType, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import DisplayMissingInfo from './DisplayMissingInfo';

const withOSRDStdcmMissingInfo = <T extends {}>(Component: ComponentType<T>) => {
  return (hocProps: T) => {
    const { t } = useTranslation('missingInfo');

    const infra = useSelector((state: any) => state.osrdconf.infraID);
    const timeTable = useSelector((state: any) => state.osrdconf.timetableID);
    const rollingStock = useSelector((state: any) => state.osrdconf.rollingStockID);
    const speedLimitByTag = useSelector((state: any) => state.osrdconf.speedLimitByTag);

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
        <Component {...(hocProps as T)} missingInfoList={missingInfoList} isCorrect={isCorrect} />
      )
    );
  };
};

export default withOSRDStdcmMissingInfo(DisplayMissingInfo);
