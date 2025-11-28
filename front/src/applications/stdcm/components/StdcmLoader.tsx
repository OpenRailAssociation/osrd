import { useEffect, useRef, useState, type RefObject } from 'react';

import { Button } from '@osrd-project/ui-core';
import cx from 'classnames';
import type { FeatureCollection } from 'geojson';
import { useTranslation } from 'react-i18next';

import {
  type GetTimetableStdcmGetAsyncProgressApiResponse,
  osrdEditoastApi,
} from '../../../common/api/osrdEditoastApi';
import type { LoaderStatus } from '../types';

const LOADER_HEIGHT = 176;
const LOADER_OFFSET = 32;

type StdcmLoaderProps = {
  isPendingAdditional: boolean;
  cancelStdcmRequest: () => void;
  launchButtonRef: RefObject<HTMLDivElement | null>;
  formRef: RefObject<HTMLDivElement | null>;
  currentRequestId: string | null;
  setProgressGeom: (value: FeatureCollection) => void;
};

function formatSeconds(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  const paddedMinutes = minutes.toString().padStart(2, '0');
  const paddedSeconds = remainingSeconds.toString().padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${paddedMinutes}:${paddedSeconds}`;
  } else {
    return `${paddedMinutes}:${paddedSeconds}`;
  }
}

const StdcmLoader = ({
  cancelStdcmRequest,
  launchButtonRef,
  formRef,
  isPendingAdditional,
  currentRequestId,
  setProgressGeom,
}: StdcmLoaderProps) => {
  const { t } = useTranslation('stdcm');
  const loaderRef = useRef<HTMLDivElement>(null);

  const { top } = launchButtonRef.current?.getBoundingClientRect() ?? { top: 0 };
  const windowHeight = window.innerHeight;

  const [loaderStatus, setLoaderStatus] = useState<LoaderStatus>({
    status: windowHeight - top - 32 > LOADER_HEIGHT ? 'loader-absolute' : 'loader-fixed-bottom',
    firstLaunch: true,
  });

  const [progressData, setProgressData] =
    useState<GetTimetableStdcmGetAsyncProgressApiResponse | null>(null);

  const [getTimetableStdcmGetAsyncProgress] =
    osrdEditoastApi.endpoints.getTimetableStdcmGetAsyncProgress.useLazyQuery();

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

  useEffect(() => {
    if (!currentRequestId) return;

    const intervalId = setInterval(async () => {
      try {
        const updatedProgress = await getTimetableStdcmGetAsyncProgress({
          id: currentRequestId,
        }).unwrap();
        setProgressData(updatedProgress);

        const featureCollection: FeatureCollection = {
          type: 'FeatureCollection',
          features: updatedProgress.map((element) => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: element.coordinates.toReversed(),
            },
            properties: {},
          })),
        };
        setProgressGeom(featureCollection);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    }, 100);

    return () => clearInterval(intervalId);
  }, [currentRequestId]);

  let progressPercentage = 0;
  const detailStrings = [];
  if (progressData != null && progressData.length > 0) {
    const maxElement = progressData.reduce((max, current) =>
      current.sample_count > max.sample_count ? current : max
    );
    const lastElement = progressData[progressData.length - 1];

    progressPercentage = (maxElement.sample_count / maxElement.out_of) * 100;
    detailStrings.push('Memory used: ' + lastElement.mb_used + ' / ' + lastElement.max_mb + ' MB');
    detailStrings.push(
      'Current best possible travel time: ' +
        formatSeconds(lastElement.time_since_departure + lastElement.best_remaining_time)
    );
    detailStrings.push(
      'Time since search started : ' + formatSeconds(lastElement.time_since_search_started)
    );
    detailStrings.push('Total number of visited nodes: ' + maxElement.number_visited_nodes);
    detailStrings.push(maxElement.sample_count + ' / ' + maxElement.out_of);
  } else {
    detailStrings.push('Starting up...');
  }
  if (progressPercentage >= 100) {
    detailStrings.push('Running post-processing...');
  }

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
      <p className="stdcm-loader__info-message">
        {'Last progress sample for request ' + currentRequestId + ':'}
      </p>
      {detailStrings.map((str, index) => (
        <p key={index} className="stdcm-loader__info-message">
          {str}
        </p>
      ))}
      <div className="progress-bar-container">
        <div className="progress-bar" style={{ width: `${progressPercentage}%` }}></div>
      </div>
    </div>
  );
};

export default StdcmLoader;
