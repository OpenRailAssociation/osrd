import React from 'react';
import { useTranslation } from 'react-i18next';

import type { Train } from 'reducers/osrdsimulation/types';
import DriverTrainScheduleStop from './DriverTrainScheduleStop';
import type { BaseOrEcoType } from './DriverTrainScheduleTypes';

type Props = {
  train: Train;
  baseOrEco: BaseOrEcoType;
};

export default function DriverTrainScheduleStopList({ train, baseOrEco }: Props) {
  const { t } = useTranslation(['operationalStudies/drivertrainschedule']);
  const trainRegime = train[baseOrEco];

  if (!trainRegime) return null;
  return (
    <>
      <div className="small text-right text-muted mt-1">
        {t('numberoflines')} :<span className="font-weight-bold"> {trainRegime.stops.length}</span>
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
            {trainRegime.stops.map((stop, idx) => (
              <DriverTrainScheduleStop
                stop={stop}
                idx={idx}
                train={train}
                key={`train-${train.id}-stop-${idx}-${stop.id}-${stop.name}`}
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
