import React from 'react';
import { useTranslation } from 'react-i18next';
import nextId from 'react-id-generator';

import { jouleToKwh } from 'utils/physics';
import { Stop, Train } from 'reducers/osrdsimulation/types';
import { LightRollingStock } from 'common/api/osrdEditoastApi';
import formatStops, { massWithOneDecimal } from './DriverTrainScheduleHelpers';

function originStop(stop: Stop) {
  return (
    <div className="text-primary" key={nextId()}>
      {stop.name || 'Unknown'}
    </div>
  );
}

export default function DriverTrainScheduleContent({
  train,
  rollingStock,
}: {
  train: Train;
  rollingStock: LightRollingStock;
}) {
  const { t } = useTranslation(['drivertrainschedule']);
  return (
    <div className="container-drivertrainschedule">
      <h1 className="text-blue mt-2">
        {t('drivertrainschedule:dcmdetails')}
        <span className="ml-1 text-normal">{train.name}</span>
      </h1>
      <div className="row">
        <div className="col-xl-4">
          <div className="row no-gutters">
            <div className="col-4">{t('drivertrainschedule:origin')}</div>
            <div className="font-weight-bold text-primary col-8">
              {train.base.stops.map((stop) => originStop(stop))[0]}
            </div>
          </div>
          <div className="row no-gutters">
            <div className="col-4">{t('drivertrainschedule:destination')}</div>
            <div className="font-weight-bold text-primary col-8">
              {train.base.stops.map((stop) => originStop(stop)).slice(-1)}
            </div>
          </div>
        </div>
        <div className="col-xl-4 my-xl-0 my-1">
          <div className="row no-gutters">
            <div className="col-4 col-xl-5">{t('drivertrainschedule:rollingstock')}</div>
            <div className="font-weight-bold text-primary col-8 col-xl-7">{rollingStock.name}</div>
          </div>
          <div className="row no-gutters">
            <div className="col-4 col-xl-5">{t('drivertrainschedule:mass')}</div>
            <div className="font-weight-bold text-primary col-8 col-xl-7">
              {massWithOneDecimal(rollingStock.mass)}T
            </div>
          </div>
        </div>
        <div className="col-xl-4">
          <div className="row no-gutters">
            <div className="col-4">{t('drivertrainschedule:composition')}</div>
            <div className="font-weight-bold text-primary col-8">{train.speed_limit_tags}</div>
          </div>
        </div>
      </div>
      <h1 className="text-blue mt-2">{t('drivertrainschedule:energydetails')}</h1>
      <div className="row">
        <div className="col-4">{t('drivertrainschedule:energyconsumed-basic')}</div>
        <div className="font-weight-bold text-primary col-8">
          {jouleToKwh(train.base.mechanical_energy_consumed, true)} kWh
        </div>
      </div>
      {train.eco != null && (
        <div className="row">
          <div className="col-4">{t('drivertrainschedule:energyconsumed-eco')}</div>
          <div className="font-weight-bold text-primary col-8">
            {jouleToKwh(train.eco.mechanical_energy_consumed, true)} kWh
          </div>
        </div>
      )}
      <div className="text-right font-italic text-cyan">
        {t('drivertrainschedule:numberoflines')} :
        <span className="font-weight-bold ml-1"> {train.base.stops.length}</span>
      </div>
      <div className="simulation-drivertrainschedule ml-auto mr-auto">
        <table className="table-drivertrainschedule table-hover">
          <thead className="bg-light">
            <tr>
              <th className="text-center text-primary mt-1">
                {t('drivertrainschedule:placeholderline')}
              </th>
              <th colSpan={3} className="text-primary mt-1">
                {t('drivertrainschedule:speed')}
              </th>
              <th className="text-center text-primary mt-1">{t('drivertrainschedule:pk')}</th>
              <th className="text-center text-primary mt-1">{t('drivertrainschedule:place')}</th>
              <th className="text-center text-primary mt-1">{t('drivertrainschedule:time')}</th>
              <th className="text-center text-primary mt-1">
                {t('drivertrainschedule:trackname')}
              </th>
            </tr>
            <tr className="text-primary small text-uppercase">
              <td />
              <th className="font-weight-normal pb-1 text-center">
                <span className="d-none d-lg-block d-xl-block">
                  {t('drivertrainschedule:speedlimit')}
                </span>
                <span className="d-lg-none d-xl-none">
                  {t('drivertrainschedule:speedlimit-short')}
                </span>
              </th>
              <th className="font-weight-normal text-center">
                <span className="d-none d-lg-block d-xl-block">
                  {t('drivertrainschedule:actualspeed')}
                </span>
                <span className="d-lg-none d-xl-none">
                  {t('drivertrainschedule:actualspeed-short')}
                </span>
              </th>
              <th className="font-weight-normal text-center">
                <span className="d-none d-lg-block d-xl-block">
                  {t('drivertrainschedule:averagespeed')}
                </span>
                <span className="d-lg-none d-xl-none">
                  {t('drivertrainschedule:averagespeed-short')}
                </span>
              </th>
              <td colSpan={4} />
            </tr>
          </thead>
          <tbody className="font-weight-normal">
            {train.base.stops.map((stop, idx) => formatStops(stop, idx, train))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
