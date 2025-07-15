import { useEffect, useRef, useState, type RefObject } from 'react';

import { Button } from '@osrd-project/ui-core';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import type { LoaderStatus } from '../types';

const LOADER_HEIGHT = 176;
const LOADER_OFFSET = 32;

type StdcmLoaderProps = {
  isPendingAdditional: boolean;
  cancelStdcmRequest: () => void;
  launchButtonRef: RefObject<HTMLDivElement | null>;
  formRef: RefObject<HTMLDivElement | null>;
};

const StdcmLoader = ({
  cancelStdcmRequest,
  launchButtonRef,
  formRef,
  isPendingAdditional,
}: StdcmLoaderProps) => {
  const { t } = useTranslation('stdcm');
  const loaderRef = useRef<HTMLDivElement>(null);

  const { top } = launchButtonRef.current?.getBoundingClientRect() ?? { top: 0 };
  const windowHeight = window.innerHeight;

  const [loaderStatus, setLoaderStatus] = useState<LoaderStatus>({
    status: windowHeight - top - 32 > LOADER_HEIGHT ? 'loader-absolute' : 'loader-fixed-bottom',
    firstLaunch: true,
  });

  useEffect(() => {
    // Depending on the scroll, change the position of the loader between fixed, sticky or absolute
    const handleScroll = () => {
      if (!loaderRef.current || !launchButtonRef.current || !formRef.current) return;

      const { scrollY, innerHeight } = window;

      const isLoaderFitting =
        innerHeight - launchButtonRef.current.getBoundingClientRect().top >
        LOADER_HEIGHT + LOADER_OFFSET;

      // Loader doesn't fit between the bottom of the form and bottom of the viewport
      if (!isLoaderFitting) {
        setLoaderStatus({
          firstLaunch: false,
          status: 'loader-fixed-bottom',
        });
        return;
      }

      const currentFormHeight = formRef.current.clientHeight;
      const topFormPosition = formRef.current.getBoundingClientRect().top;
      const launchButtonHeight = launchButtonRef.current.clientHeight;
      const shouldLoaderStickTop =
        scrollY >
        currentFormHeight + scrollY + topFormPosition - launchButtonHeight - LOADER_OFFSET;

      // Loader reaches the top of the screen minus its top offset
      if (shouldLoaderStickTop) {
        setLoaderStatus({
          firstLaunch: false,
          status: 'loader-fixed-top',
        });
        return;
      }

      setLoaderStatus({
        firstLaunch: false,
        status: 'loader-absolute',
      });
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <div
      ref={loaderRef}
      className={cx('stdcm-loader', `${loaderStatus.status}`, {
        'with-fade-in-animation':
          loaderStatus.status === 'loader-absolute' && loaderStatus.firstLaunch,
        'with-slide-animation':
          loaderStatus.status === 'loader-fixed-bottom' && loaderStatus.firstLaunch,
      })}
    >
      <div className="stdcm-loader__wrapper">
        <h2>
          {t(
            isPendingAdditional
              ? 'simulation.additionalResults'
              : 'simulation.calculatingSimulation'
          )}
        </h2>
        <div className="stdcm-loader__cancel-btn">
          <Button
            data-testid="cancel-simulation-button"
            variant="Cancel"
            label={t('simulation.stopCalculation')}
            size="small"
            onClick={cancelStdcmRequest}
          />
        </div>
      </div>
      <p className="stdcm-loader__info-message">{t('simulation.infoMessage')}</p>
    </div>
  );
};

export default StdcmLoader;
