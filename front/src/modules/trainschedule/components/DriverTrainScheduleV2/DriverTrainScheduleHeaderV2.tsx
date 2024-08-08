import React from 'react';

import { Download } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import type {
  ElectrificationRangeV2,
  SimulationResponseSuccess,
} from 'applications/operationalStudies/types';
import type { LightRollingStock, TrainScheduleBase } from 'common/api/osrdEditoastApi';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';
import { jouleToKwh } from 'utils/physics';

import { BaseOrEco, BASE_OR_ECO_OPTIONS, type BaseOrEcoType } from './consts';
import exportTrainCSV from './exportDriverScheduleCSV';
import type { OperationalPointWithTimeAndSpeed } from './types';
import { isEco, massWithOneDecimal } from './utils';

type DriverTrainScheduleHeaderV2Props = {
  simulatedTrain: SimulationResponseSuccess;
  train: TrainScheduleBase;
  operationalPoints: OperationalPointWithTimeAndSpeed[];
  electrificationRanges: ElectrificationRangeV2[];
  rollingStock: LightRollingStock;
  baseOrEco: BaseOrEcoType;
  setBaseOrEco: (baseOrEco: BaseOrEcoType) => void;
};

const DriverTrainScheduleHeaderV2 = ({
  simulatedTrain,
  train,
  operationalPoints,
  electrificationRanges,
  rollingStock,
  baseOrEco,
  setBaseOrEco,
}: DriverTrainScheduleHeaderV2Props) => {
  const { t } = useTranslation(['operationalStudies/drivertrainschedule']);
  const trainRegime =
    baseOrEco === BaseOrEco.base ? simulatedTrain.base : simulatedTrain.final_output;

  // Get origin and destination via first and last operational points

  return (
    <>
      <div className="d-flex align-items-center">
        <h1 className="text-blue flex-grow-1">{train.train_name}</h1>
        {isEco(train) && (
          <div className="text-uppercase">
            <OptionsSNCF
              name="driver-train-schedule-base-or-eco"
              sm
              onChange={(e) => setBaseOrEco(e.target.value as BaseOrEcoType)}
              options={BASE_OR_ECO_OPTIONS}
              selectedValue={baseOrEco}
            />
          </div>
        )}
        <button
          type="button"
          className="btn btn-link ml-2"
          onClick={() =>
            exportTrainCSV(
              simulatedTrain,
              operationalPoints,
              electrificationRanges,
              baseOrEco,
              train
            )
          }
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
              {operationalPoints[0]?.name || t('unknownStop')}
            </div>
          </div>
          <div className="row no-gutters align-items-center">
            <div className="col-xl-4 col-5">{t('destination')}</div>
            <div className="font-weight-bold text-primary col-xl-8 col-7">
              {operationalPoints.at(-1)?.name || t('unknownStop')}
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
            <div className="font-weight-bold text-primary col-6">{train.speed_limit_tag}</div>
          </div>
          <div className="row no-gutters align-items-center">
            <div className="col-6">{t('energydetails')}</div>
            <div
              className={cx(
                'font-weight-bold col-6',
                baseOrEco === BaseOrEco.base ? 'text-primary' : 'text-green'
              )}
            >
              {jouleToKwh(trainRegime.energy_consumption, true)} kWh
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default DriverTrainScheduleHeaderV2;
