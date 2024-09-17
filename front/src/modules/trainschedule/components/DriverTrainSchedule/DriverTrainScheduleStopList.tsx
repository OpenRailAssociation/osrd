import { useMemo } from 'react';

import { useTranslation } from 'react-i18next';

import type { SimulationResponseSuccess } from 'applications/operationalStudies/types';
import type { ReportTrain } from 'common/api/osrdEditoastApi';
import type { PositionSpeedTime, SpeedRanges } from 'reducers/simulationResults/types';
import { mmToM } from 'utils/physics';

import DriverTrainScheduleStop from './DriverTrainScheduleStop';
import type { OperationalPointWithTimeAndSpeed } from './types';

type DriverTrainScheduleStopListProps = {
  trainRegime: ReportTrain | SimulationResponseSuccess['final_output'];
  mrsp: SimulationResponseSuccess['mrsp'];
  operationalPoints: OperationalPointWithTimeAndSpeed[];
};

const DriverTrainScheduleStopList = ({
  trainRegime,
  mrsp,
  operationalPoints,
}: DriverTrainScheduleStopListProps) => {
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

  const formattedMrsp: SpeedRanges = useMemo(
    () => ({
      internalBoundaries: mrsp.boundaries.map((boundary) => mmToM(boundary)),
      speeds: mrsp.values.map(({ speed }) => speed),
    }),
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
                <DriverTrainScheduleStop
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

export default DriverTrainScheduleStopList;
