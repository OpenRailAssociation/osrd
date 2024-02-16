import React, { useEffect } from 'react';
import cx from 'classnames';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { STANDARD_COMFORT_LEVEL } from 'modules/rollingStock/consts';
import { floor, isEmpty, uniq } from 'lodash';
import { useAppDispatch } from 'store';
import { setFailure } from 'reducers/main';
import { useTranslation } from 'react-i18next';

import { Loader } from 'common/Loaders/Loader';
import RollingStockCurves from 'modules/rollingStock/components/RollingStockCurve';
import RollingStock2Img from 'modules/rollingStock/components/RollingStock2Img';

import type { EffortCurveForms } from 'modules/rollingStock/types';
import type { RollingStockComfortType, RollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import { castErrorToFailure } from 'utils/error';

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
  const dispatch = useAppDispatch();
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
        setFailure(
          castErrorToFailure(error, {
            name: t('errorMessages.unableToRetrieveRollingStockMessage'),
            message: t('errorMessages.unableToRetrieveRollingStock'),
          })
        )
      );
    }
  }, [error]);

  const leftColumn = (rs: RollingStockWithLiveries) => (
    <table className="rollingstock-details-table">
      <tbody>
        <tr>
          <td className="text-primary">{t('startupTime')}</td>
          <td>
            {rs.startup_time}
            <span className="small ml-1 text-muted">s</span>
          </td>
        </tr>
        <tr>
          <td className="text-primary">{t('startupAcceleration')}</td>
          <td>
            {rs.startup_acceleration}
            <span className="small ml-1 text-muted">m/s²</span>
          </td>
        </tr>
        <tr>
          <td className="text-primary">{t('comfortAcceleration')}</td>
          <td>
            {rs.comfort_acceleration}
            <span className="small ml-1 text-muted">m/s²</span>
          </td>
        </tr>
        <tr>
          <td className="text-primary">{t('inertiaCoefficient')}</td>
          <td>{rs.inertia_coefficient}</td>
        </tr>
        <tr>
          <td className="text-primary">{t('gammaValue')}</td>
          <td>
            {rs.gamma.value * -1}
            <span className="small ml-1 text-muted">m/s²</span>
          </td>
        </tr>
        <tr>
          <td className="text-primary">{t('loadingGauge')}</td>
          <td>{rs.loading_gauge}</td>
        </tr>
        <tr>
          <td className="text-primary">{t('basePowerClass')}</td>
          <td>{rs.base_power_class}</td>
        </tr>
      </tbody>
    </table>
  );
  const rightColumn = (rs: RollingStockWithLiveries) => (
    <table className="rollingstock-details-table">
      <tbody>
        <tr>
          <td className={cx({ formResistance: form })}>{t('rollingResistance')}</td>
          <td className={cx('text-primary text-muted', { formResistance: form })}>
            {t('rollingResistanceFormula')}
          </td>
        </tr>
        <tr>
          <td className="text-primary">{t('rollingResistanceA')}</td>
          <td>
            {Math.floor(rs.rolling_resistance?.A ? (rs.rolling_resistance.A * 10000) / 10000 : 0)}
            <span className="small ml-1 text-muted">N</span>
          </td>
        </tr>
        <tr>
          <td className="text-primary">{t('rollingResistanceB')}</td>
          <td>
            {Math.floor(rs.rolling_resistance?.B ? (rs.rolling_resistance.B * 10000) / 10000 : 0)}
            <span className="small ml-1 text-muted">N/(m/s)</span>
          </td>
        </tr>
        <tr>
          <td className="text-primary">{t('rollingResistanceC')}</td>
          <td title={rs.rolling_resistance?.C.toString()}>
            {floor(rs.rolling_resistance?.C ?? 0, 2)}
            <span className="small ml-1 text-muted">N/(m/s)²</span>
          </td>
        </tr>
        {!isEmpty(rs.supported_signaling_systems) && (
          <tr>
            <td className="text-primary text-nowrap pr-1">{t('supportedSignalingSystems')}</td>
            <td>{rs.supported_signaling_systems.join(', ')}</td>
          </tr>
        )}
        {rs.power_restrictions && Object.keys(rs.power_restrictions).length !== 0 && (
          <tr>
            <td className="text-primary text-nowrap pr-1">
              {t('powerRestrictionsInfos', {
                count: Object.keys(rs.power_restrictions).length,
              })}
            </td>
            <td>
              {rs.power_restrictions !== null && Object.keys(rs.power_restrictions).join(' ')}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
  return rollingStock && !isEmpty(curvesComfortList) ? (
    <div className={form ? 'px-4' : 'rollingstock-card-body'}>
      <div className={`row pt-2 ${form}`}>
        <div className="col-sm-6">{leftColumn(rollingStock)}</div>
        <div className="col-sm-6">{rightColumn(rollingStock)}</div>
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
