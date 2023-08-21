import { isEmpty } from 'lodash';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';

import { Comfort, RollingStock, osrdEditoastApi } from 'common/api/osrdEditoastApi';
import Loader from 'common/Loader';
import { setFailure } from 'reducers/main';
import RollingStock2Img from './RollingStock2Img';
import RollingStockCurves from './RollingStockCurves';

type RollingStockCardDetailProps = {
  id: number;
  hideCurves?: boolean;
  form?: string;
  curvesComfortList: Comfort[];
  setCurvesComfortList: (curvesComfortList: Comfort[]) => void;
};

export const listCurvesComfort = (curvesData: RollingStock['effort_curves']) => {
  const comfortList: Comfort[] = ['STANDARD'];
  Object.keys(curvesData.modes).forEach((mode) => {
    curvesData.modes[mode].curves.forEach((curve) => {
      if (curve.cond?.comfort) {
        if (!comfortList.includes(curve.cond.comfort)) comfortList.push(curve.cond.comfort);
      }
    });
  });
  return comfortList;
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
  const { data: rollingStock, error } = osrdEditoastApi.useGetRollingStockByIdQuery(
    { id },
    {
      skip: !id,
    }
  );

  useEffect(() => {
    if (rollingStock) setCurvesComfortList(listCurvesComfort(rollingStock.effort_curves));
  }, [rollingStock]);

  useEffect(() => {
    if (error) {
      dispatch(
        setFailure({
          name: t('rollingstock:errorMessages.unableToRetrieveRollingStockMessage'),
          message: t('rollingstock:errorMessages.unableToRetrieveRollingStock'),
        })
      );
    }
  }, [error]);

  return rollingStock && !isEmpty(curvesComfortList) ? (
    <div className={`${form ? 'px-4' : 'rollingstock-body'}`}>
      <div className={`row pt-2  ${form}`}>
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
                      {t('powerRestriction', {
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
          <div>
            <div className={form ? 'formResistance ml-2' : ''}>{t('rollingResistance')}</div>
            <div className={`text-primary text-muted ${form ? 'formResistance ml-4' : ''}`}>
              {t('rollingResistanceFormula')}
            </div>
          </div>
          <table className="rollingstock-details-table ml-2">
            <tbody>
              <tr>
                <td className="text-primary">a</td>
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
                <td className="text-primary">b</td>
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
                <td className="text-primary">c</td>
                <td>
                  {Math.floor(
                    rollingStock.rolling_resistance?.C
                      ? (rollingStock.rolling_resistance.C * 10000) / 10000
                      : 0
                  )}
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
    <div className="rollingstock-body">
      <Loader />
    </div>
  );
}
