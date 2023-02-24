import React, { ComponentType, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { getDestination, getOrigin, getRollingStockID } from 'reducers/osrdconf/selectors';
import DisplayMissingInfo from './DisplayMissingInfo';

const withOSRDStdcmMissingInfo =
  <T extends {}>(Component: ComponentType<T>) =>
  (hocProps: T) => {
    const { t } = useTranslation('missingInfo');

    const origin = useSelector(getOrigin);
    const destination = useSelector(getDestination);
    const rollingStock = useSelector(getRollingStockID);

    const title = t('missingInfoTitle');

    const missingInfoList: string[] = [!rollingStock ? t('missingRollingStock') : ''];

    const [isShowing, setIsShowing] = useState<boolean>(false);
    const [isCorrect, setIsCorrect] = useState<boolean>(false);

    useEffect(() => {
      if (origin && destination) setIsShowing(true);
    }, [origin, destination]);

    useEffect(() => {
      if (rollingStock) setIsCorrect(true);
    }, [rollingStock]);

    return (
      !isCorrect && (
        <Component
          {...(hocProps as T)}
          title={title}
          missingInfoList={missingInfoList}
          isShowing={isShowing}
          isCorrect={isCorrect}
        />
      )
    );
  };

export default withOSRDStdcmMissingInfo(DisplayMissingInfo);
