import React, { useMemo, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import type { RootState } from 'reducers';
import type { ConsolidatedRouteAspect, PositionsSpeedTimes } from 'reducers/osrdsimulation/types';

import { useChartSynchronizer } from './ChartSynchronizer';

/**
 * Given the routeAspects and a timePosition, returns the bounds [start, end]
 * of the currently occupied canton (in meters)
 *
 * @param routeAspects
 * @param time
 * @returns current Canton occupied by current train, [start, end] in meters
 * @TODO do not work with colors as string as soon as possible
 */
const getOccupancyBounds = (
  routeAspects: ConsolidatedRouteAspect[],
  timePosition: Date
): [number, number] => {
  const relevantAspect = routeAspects.find((routeAspect) => {
    const relevantStartTime = routeAspect.time_start || new Date();
    const relevantEndTime = routeAspect.time_end || new Date();
    return (
      relevantStartTime < timePosition &&
      relevantEndTime >= timePosition &&
      routeAspect.color === 'rgba(255, 0, 0, 255)'
    );
  });
  return relevantAspect ? [relevantAspect.position_start, relevantAspect.position_end] : [0, 0];
};

export default function TrainDetails() {
  const { consolidatedSimulation, selectedTrainId } = useSelector(
    (state: RootState) => state.osrdsimulation
  );

  const [{ headPosition, tailPosition, speed }, setLocalPositionValues] = useState<
    PositionsSpeedTimes<Date>
  >({} as PositionsSpeedTimes<Date>);
  useChartSynchronizer(
    (_, positionValues) => {
      setLocalPositionValues(positionValues);
    },
    'train-detail',
    []
  );

  const { t } = useTranslation(['simulation']);

  const occupancyBounds = useMemo(() => {
    const foundTrain = consolidatedSimulation.find((train) => train.id === selectedTrainId);

    return foundTrain && getOccupancyBounds(foundTrain.routeAspects, new Date(headPosition?.time));
  }, [consolidatedSimulation, headPosition, tailPosition, speed, selectedTrainId]);

  return (
    <div className="d-flex">
      {headPosition && (
        <>
          <div className="rounded px-1 train-detail small bg-blue text-white text-nowrap mr-2">
            <div className="font-weight-bold text-uppercase">{t('trainDetails.headPosition')}</div>
            {headPosition && Math.round(headPosition.position) / 1000}
            km
          </div>
          <div className="rounded px-1 train-detail small bg-cyan text-white text-nowrap mr-2">
            <div className="font-weight-bold text-uppercase">{t('trainDetails.tailPosition')}</div>
            {tailPosition && Math.round(tailPosition.position) / 1000}
            km
          </div>
          {occupancyBounds && (
            <>
              <div className="rounded px-1 train-detail small bg-success text-black text-nowrap mr-2">
                <div className="font-weight-bold text-uppercase">
                  {t('trainDetails.routeBeginOccupancy')}
                </div>
                {Math.round(occupancyBounds[0]) / 1000}
                km
              </div>
              <div className="rounded px-1 train-detail small bg-yellow text-black text-nowrap mr-2">
                <div className="font-weight-bold text-uppercase">
                  {t('trainDetails.routeEndOccupancy')}
                </div>
                {Math.round(occupancyBounds[1]) / 1000}
                km
              </div>
              <div className="rounded px-1 train-detail small bg-secondary text-white text-nowrap mr-2">
                <div className="font-weight-bold text-uppercase">
                  {t('trainDetails.routeSizeOccupancy')}
                </div>
                {Math.round(occupancyBounds[1] - occupancyBounds[0]) / 1000}
                km
              </div>
            </>
          )}
          <div className="rounded px-1 train-detail small bg-pink text-white">
            <div className="font-weight-bold text-uppercase">{t('trainDetails.speed')}</div>
            {speed && Math.round(speed.speed)}
            km/h
          </div>
        </>
      )}
    </div>
  );
}
