import React, { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import { useOsrdConfSelectors } from 'common/osrdContext';
import DisplayMissingInfo from 'common/DisplayMissingInfo/DisplayMissingInfo';

const withOSRDStdcmMissingInfo =
  <T extends object>(Component: ComponentType<T>) =>
  (hocProps: T) => {
    const { t } = useTranslation('missingInfo');
    const { getDestination, getOrigin, getRollingStockID } = useOsrdConfSelectors();

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
