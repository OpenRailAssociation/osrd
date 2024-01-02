import React, { useEffect } from 'react';
import cx from 'classnames';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { STANDARD_COMFORT_LEVEL } from 'modules/rollingStock/consts';
import { floor, isEmpty, uniq } from 'lodash';
import { setFailure } from 'reducers/main';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';

import { Loader } from 'common/Loaders/Loader';
import RollingStockCurves from 'modules/rollingStock/components/RollingStockCurve';
import RollingStock2Img from 'modules/rollingStock/components/RollingStock2Img';

import type { EffortCurveForms } from 'modules/rollingStock/types';
import type { RollingStockComfortType } from 'common/api/osrdEditoastApi';

type RollingStockCardDetailProps = {
  id: number;
  hideCurves?: boolean;
  form?: string;
  curvesComfortList: RollingStockComfortType[];
  setCurvesComfortList: (curvesComfortList: RollingStockComfortType[]) => void;
};

export const getCurvesComforts = (curvesData: EffortCurveForms) => {
  const modes = Object.keys(curvesData);
  return modes.length
    ? modes.reduce<RollingStockComfortType[]>((list, mode) => {
        const modeComfortList = curvesData[mode].curves.reduce(
          (acc, curve) => {
            const { comfort } = curve.cond;
            if (comfort && !acc.includes(comfort)) acc.push(comfort);
            return acc;
          },
          [STANDARD_COMFORT_LEVEL]
        );
        return uniq([...list, ...modeComfortList]);
      }, [])
    : [STANDARD_COMFORT_LEVEL];
};

export default function RollingStockCardDetail({
  id,
  hideCurves,
  form,
  curvesComfortList,
  setCurvesComfortList,
}: RollingStockCardDetailProps) {
  const dispatch = useDispatch();
  const { t } = useTranslation(['rollingstock']);

  // we only fetch the whole rollingStock here, when we open the card and display its details
  const { data: rollingStock, error } = osrdEditoastApi.useGetRollingStockByRollingStockIdQuery(
    { rollingStockId: id },
    {
      skip: !id,
    }
  );

  useEffect(() => {
    if (rollingStock) setCurvesComfortList(getCurvesComforts(rollingStock.effort_curves.modes));
  }, [rollingStock]);

  useEffect(() => {
    if (error) {
      dispatch(
        setFailure({
          name: t('errorMessages.unableToRetrieveRollingStockMessage'),
          message: t('errorMessages.unableToRetrieveRollingStock'),
        })
      );
    }
  }, [error]);

  return rollingStock && !isEmpty(curvesComfortList) ? (
    <div className={form ? 'px-4' : 'rollingstock-card-body'}>
      <div className={`row pt-2 ${form}`}>
        <div className="col-sm-6">
          <table className="rollingstock-details-table">
            <tbody>
              <tr>
                <td className="text-primary">{t('startupTime')}</td>
                <td>
                  {rollingStock.startup_time}
                  <span className="small ml-1 text-muted">s</span>
                </td>
              </tr>
              <tr>
                <td className="text-primary">{t('startupAcceleration')}</td>
                <td>
                  {rollingStock.startup_acceleration}
                  <span className="small ml-1 text-muted">m/s²</span>
                </td>
              </tr>
              <tr>
                <td className="text-primary">{t('comfortAcceleration')}</td>
                <td>
                  {rollingStock.comfort_acceleration}
                  <span className="small ml-1 text-muted">m/s²</span>
                </td>
              </tr>
              <tr>
                <td className="text-primary">{t('inertiaCoefficient')}</td>
                <td>{rollingStock.inertia_coefficient}</td>
              </tr>
              <tr>
                <td className="text-primary">{t('gammaValue')}</td>
                <td>
                  {rollingStock.gamma.value * -1}
                  <span className="small ml-1 text-muted">m/s²</span>
                </td>
              </tr>
              <tr>
                <td className="text-primary">{t('loadingGauge')}</td>
                <td>{rollingStock.loading_gauge}</td>
              </tr>
              <tr>
                <td className="text-primary">{t('basePowerClass')}</td>
                <td>{rollingStock.base_power_class}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="col-sm-6">
          {rollingStock.features && rollingStock.features.length > 0 && (
            <div className="pb-1">
              {t('features')}
              <span className="ml-1">{rollingStock.features.join(', ')}</span>
            </div>
          )}
          {rollingStock.power_restrictions &&
            Object.keys(rollingStock.power_restrictions).length !== 0 && (
              <table className="rollingstock-details-table mb-1">
                <tbody>
                  <tr>
                    <td className="text-primary text-nowrap pr-1">
                      {t('powerRestrictionsInfos', {
                        count: Object.keys(rollingStock.power_restrictions).length,
                      })}
                    </td>
                    <td>
                      {rollingStock.power_restrictions !== null &&
                        Object.keys(rollingStock.power_restrictions).join(' ')}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          <table className="rollingstock-details-table ml-2">
            <tbody>
              <tr>
                <td colSpan={2} className={cx({ 'formResistance ml-2': form })}>
                  {t('rollingResistance')}
                </td>
              </tr>
              <tr>
                <td
                  colSpan={2}
                  className={cx('text-primary text-muted', { 'formResistance ml-4': form })}
                >
                  {t('rollingResistanceFormula')}
                </td>
              </tr>
              <tr>
                <td>
                  {Math.floor(
                    rollingStock.rolling_resistance?.A
                      ? (rollingStock.rolling_resistance.A * 10000) / 10000
                      : 0
                  )}
                  <span className="small ml-1 text-muted">N</span>
                </td>
                <td className="text-primary">{t('rollingResistanceA')}</td>
              </tr>
              <tr>
                <td>
                  {Math.floor(
                    rollingStock.rolling_resistance?.B
                      ? (rollingStock.rolling_resistance.B * 10000) / 10000
                      : 0
                  )}
                  <span className="small ml-1 text-muted">N/(m/s)</span>
                </td>
                <td className="text-primary">{t('rollingResistanceB')}</td>
              </tr>
              <tr>
                <td title={rollingStock.rolling_resistance?.C.toString()}>
                  {floor(rollingStock.rolling_resistance?.C ?? 0, 2)}
                  <span className="small ml-1 text-muted">N/(m/s)²</span>
                </td>
                <td className="text-primary">{t('rollingResistanceC')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      {!hideCurves && (
        <>
          <RollingStockCurves
            data={rollingStock.effort_curves.modes}
            curvesComfortList={curvesComfortList}
          />
          <div className="rollingstock-detail-container-img">
            <div className="rollingstock-detail-img">
              <RollingStock2Img rollingStock={rollingStock} />
            </div>
          </div>
        </>
      )}
    </div>
  ) : (
    <div className="rollingstock-card-body">
      <Loader />
    </div>
  );
}
