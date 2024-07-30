import React, { useMemo } from 'react';

import { useTranslation } from 'react-i18next';

import type { SimulationResponseSuccess } from 'applications/operationalStudies/types';
import type { ReportTrainV2 } from 'common/api/osrdEditoastApi';
import type { PositionSpeedTime } from 'reducers/osrdsimulation/types';
import { mmToM } from 'utils/physics';

import DriverTrainScheduleStopV2 from './DriverTrainScheduleStopV2';
import type { OperationalPointWithTimeAndSpeed } from './types';

type DriverTrainScheduleStopListV2Props = {
  trainRegime: ReportTrainV2 | SimulationResponseSuccess['final_output'];
  mrsp: SimulationResponseSuccess['mrsp'];
  operationalPoints: OperationalPointWithTimeAndSpeed[];
};

const DriverTrainScheduleStopListV2 = ({
  trainRegime,
  mrsp,
  operationalPoints,
}: DriverTrainScheduleStopListV2Props) => {
  const { t } = useTranslation(['operationalStudies/drivertrainschedule']);

  const formattedTrainRegimeReports: PositionSpeedTime[] = useMemo(
    () =>
      trainRegime.positions.map((position, index) => ({
        position: mmToM(position),
        speed: trainRegime.speeds[index],
        time: trainRegime.times[index],
      })),
    [trainRegime]
  );

  const formattedMrsp = useMemo(
    () =>
      mrsp.positions.map((_position, index) => ({
        position: _position,
        speed: mrsp.speeds[index],
      })),
    [mrsp]
  );

  return (
    <>
      <div className="small text-right text-muted mt-1">
        {t('numberoflines')} :<span className="font-weight-bold"> {operationalPoints.length}</span>
      </div>
      <div className="driver-train-schedule-table-container">
        <table className="table-drivertrainschedule table-hover">
          <thead className="bg-light text-primary">
            <tr>
              <th className="text-center">{t('placeholderline')}</th>
              <th colSpan={3}>{t('speed')}</th>
              <th className="text-center">{t('pk')}</th>
              <th className="text-center">{t('place')}</th>
              <th className="text-center">{t('time')}</th>
              <th className="text-center">{t('trackname')}</th>
            </tr>
            <tr className="small text-uppercase">
              <td aria-hidden />
              <th className="font-weight-normal pb-1 text-center">
                <span className="d-none d-lg-block d-xl-block">{t('speedlimit')}</span>
                <span className="d-lg-none d-xl-none">{t('speedlimit-short')}</span>
              </th>
              <th className="font-weight-normal text-center">
                <span className="d-none d-lg-block d-xl-block">{t('actualspeed')}</span>
                <span className="d-lg-none d-xl-none">{t('actualspeed-short')}</span>
              </th>
              <th className="font-weight-normal text-center">
                <span className="d-none d-lg-block d-xl-block">{t('averagespeed')}</span>
                <span className="d-lg-none d-xl-none">{t('averagespeed-short')}</span>
              </th>
              <td colSpan={4} aria-hidden />
            </tr>
          </thead>
          <tbody>
            {operationalPoints.length > 0 &&
              operationalPoints.map((op, idx) => (
                <DriverTrainScheduleStopV2
                  operationalPoint={op}
                  operationalPoints={operationalPoints}
                  idx={idx}
                  trainRegimeReports={formattedTrainRegimeReports}
                  speedLimits={formattedMrsp}
                  key={`operationalPoint-${idx}-${op.id}-${op.name}`}
                />
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default DriverTrainScheduleStopListV2;
