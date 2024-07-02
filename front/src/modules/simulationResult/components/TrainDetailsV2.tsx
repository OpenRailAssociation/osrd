import React, { useMemo, useState } from 'react';

import { useTranslation } from 'react-i18next';

import type { TrainSpaceTimeData } from 'applications/operationalStudies/types';
import type { PositionsSpeedTimes } from 'reducers/osrdsimulation/types';

import { sec2d3datetime } from './ChartHelpers/ChartHelpers';
import { useChartSynchronizerV2 } from './ChartHelpers/ChartSynchronizerV2';

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
  routeAspects: TrainSpaceTimeData['signal_updates'],
  timePosition: Date
): [number, number] => {
  // TODO GET v2 : probably remove this conversion as trains will travel on several days
  // The chart time axis is set by d3 function *sec2d3datetime* which start the chart at 01/01/1900 00:00:00
  // As javascript new Date() util takes count of the minutes lost since 1/1/1900 (9min and 21s), we have
  // to use sec2d3datetime here as well to set the times on the chart
  const relevantAspect = routeAspects.find((routeAspect) => {
    const relevantStartTime = sec2d3datetime(routeAspect.time_start) || new Date();
    const relevantEndTime = sec2d3datetime(routeAspect.time_end) || new Date();

    return (
      relevantStartTime < timePosition &&
      relevantEndTime >= timePosition &&
      routeAspect.color === -65536 // Equivalent to 'rgba(255, 0, 0, 255)' in bits
    );
  });
  return relevantAspect ? [relevantAspect.position_start, relevantAspect.position_end] : [0, 0];
};

type TrainDetailsV2Props = {
  projectedTrain: TrainSpaceTimeData;
};

const TrainDetailsV2 = ({ projectedTrain }: TrainDetailsV2Props) => {
  const [
    { eco_headPosition: headPosition, eco_tailPosition: tailPosition, eco_speed: speed },
    setLocalPositionValues,
  ] = useState<PositionsSpeedTimes<Date>>({} as PositionsSpeedTimes<Date>);

  useChartSynchronizerV2(
    (_, positionValues) => {
      setLocalPositionValues(positionValues);
    },
    'train-detail',
    []
  );

  const { t } = useTranslation(['simulation']);

  const occupancyBounds = useMemo(
    () => getOccupancyBounds(projectedTrain.signal_updates, new Date(headPosition?.time)),
    [projectedTrain.signal_updates, headPosition, tailPosition, speed]
  );

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
};

export default TrainDetailsV2;
