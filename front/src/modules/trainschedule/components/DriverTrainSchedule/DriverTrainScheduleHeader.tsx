import React from 'react';
import { useTranslation } from 'react-i18next';

import { jouleToKwh } from 'utils/physics';
import type { Train } from 'reducers/osrdsimulation/types';
import type { LightRollingStock } from 'common/api/osrdEditoastApi';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';
import cx from 'classnames';
import { Download } from '@osrd-project/ui-icons';
import { massWithOneDecimal } from './DriverTrainScheduleHelpers';
import { BaseOrEco, type BaseOrEcoType } from './DriverTrainScheduleTypes';
import exportTrainCSV from './driverTrainScheduleExportCSV';

type Props = {
  train: Train;
  rollingStock: LightRollingStock;
  baseOrEco: BaseOrEcoType;
  setBaseOrEco: (baseOrEco: BaseOrEcoType) => void;
};

const baseOrEcoOptions = [
  {
    label: BaseOrEco.base,
    value: BaseOrEco.base,
  },
  {
    label: BaseOrEco.eco,
    value: BaseOrEco.eco,
  },
];

export default function DriverTrainScheduleHeader({
  train,
  rollingStock,
  baseOrEco,
  setBaseOrEco,
}: Props) {
  const { t } = useTranslation(['operationalStudies/drivertrainschedule']);
  const trainRegime = train[baseOrEco];

  if (!trainRegime) return null;

  return (
    <>
      <div className="d-flex align-items-center">
        <h1 className="text-blue flex-grow-1">{train.name}</h1>
        {train.eco?.stops && (
          <div className="text-uppercase">
            <OptionsSNCF
              name="driver-train-schedule-base-or-eco"
              sm
              onChange={(e) => setBaseOrEco(e.target.value as BaseOrEcoType)}
              options={baseOrEcoOptions}
              selectedValue={baseOrEco}
            />
          </div>
        )}
        <button
          type="button"
          className="btn btn-link ml-2"
          onClick={() => exportTrainCSV(train, baseOrEco)}
          aria-label="train-csv"
        >
          <Download size="lg" />
        </button>
      </div>
      <div className="row no-gutters align-items-center">
        <div className="col-hd-3 col-xl-4 col-lg-6 small">
          <div className="row no-gutters align-items-center ">
            <div className="col-xl-4 col-5">{t('origin')}</div>
            <div className="font-weight-bold text-primary col-xl-8 col-7">
              {trainRegime.stops[0].name || t('unknownStop')}
            </div>
          </div>
          <div className="row no-gutters align-items-center">
            <div className="col-xl-4 col-5">{t('destination')}</div>
            <div className="font-weight-bold text-primary col-xl-8 col-7">
              {trainRegime.stops.at(-1)?.name || t('unknownStop')}
            </div>
          </div>
        </div>
        <div className="col-hd-4 col-xl-4 col-lg-6 my-xl-0 my-1 small">
          <div className="row no-gutters align-items-center">
            <div className="col-4 col-xl-5">{t('rollingstock')}</div>
            <div className="font-weight-bold text-primary col-8 col-xl-7">{rollingStock.name}</div>
          </div>
          <div className="row no-gutters align-items-center">
            <div className="col-4 col-xl-5">{t('mass')}</div>
            <div className="font-weight-bold text-primary col-8 col-xl-7">
              {massWithOneDecimal(rollingStock.mass)}T
            </div>
          </div>
        </div>
        <div className="col-hd-5 col-xl-4 col-lg-6 small">
          <div className="row no-gutters align-items-center">
            <div className="col-6">{t('composition')}</div>
            <div className="font-weight-bold text-primary col-6">{train.speed_limit_tags}</div>
          </div>
          <div className="row no-gutters align-items-center">
            <div className="col-6">{t('energydetails')}</div>
            <div
              className={cx(
                'font-weight-bold col-6',
                baseOrEco === BaseOrEco.base ? 'text-primary' : 'text-green'
              )}
            >
              {jouleToKwh(trainRegime.mechanical_energy_consumed, true)} kWh
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
