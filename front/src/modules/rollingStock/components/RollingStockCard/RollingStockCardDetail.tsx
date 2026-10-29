import { useEffect } from 'react';

import cx from 'classnames';
import { isEmpty, uniq } from 'lodash';
import { useTranslation } from 'react-i18next';

import type { EffortCurveForms } from 'applications/rollingStockEditor/types';
import type {
  Comfort,
  LightRollingStockWithLiveries,
  RollingStockWithLiveries,
} from 'common/api/osrdEditoastApi';
import RollingStock2Img from 'modules/rollingStock/components/RollingStock2Img';
import RollingStockCurves from 'modules/rollingStock/components/RollingStockCurve';
import { STANDARD_COMFORT_LEVEL } from 'modules/rollingStock/consts';
import convertUnits from 'modules/rollingStock/helpers/convertUnits';

type RollingStockCardDetailProps = {
  rollingStock: LightRollingStockWithLiveries | RollingStockWithLiveries;
  hideCurves?: boolean;
  form?: string;
  curvesComfortList: Comfort[];
  setCurvesComfortList: (curvesComfortList: Comfort[]) => void;
};

export const getCurvesComforts = (curvesData: EffortCurveForms) => {
  const modes = Object.keys(curvesData);
  return modes.length
    ? modes.reduce<Comfort[]>((list, mode) => {
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
  rollingStock,
  hideCurves,
  form,
  curvesComfortList,
  setCurvesComfortList,
}: RollingStockCardDetailProps) {
  const { t } = useTranslation();

  const fullRollingStock = 'startup_time' in rollingStock ? rollingStock : null;

  useEffect(() => {
    if (fullRollingStock)
      setCurvesComfortList(getCurvesComforts(fullRollingStock.effort_curves.modes));
    else setCurvesComfortList([]);
  }, [fullRollingStock, setCurvesComfortList]);

  const leftColumn = (rs: LightRollingStockWithLiveries | RollingStockWithLiveries) => {
    const frs = 'startup_time' in rs ? rs : null;
    return (
      <table className="rollingstock-details-table">
        <tbody>
          {frs && (
            <tr>
              <td className="text-primary">{t('rollingStock.startupTime')}</td>
              <td>
                {frs.startup_time}
                <span className="small ml-1 text-muted">s</span>
              </td>
            </tr>
          )}
          {frs && (
            <tr>
              <td className="text-primary">{t('rollingStock.startupAcceleration')}</td>
              <td>
                {frs.startup_acceleration}
                <span className="small ml-1 text-muted">m/s²</span>
              </td>
            </tr>
          )}
          {frs && (
            <tr>
              <td className="text-primary">{t('rollingStock.comfortAcceleration')}</td>
              <td>
                {frs.comfort_acceleration}
                <span className="small ml-1 text-muted">m/s²</span>
              </td>
            </tr>
          )}
          {frs && (
            <tr>
              <td className="text-primary">{t('rollingStock.inertiaCoefficient')}</td>
              <td>{frs.inertia_coefficient}</td>
            </tr>
          )}
          {frs && (
            <tr>
              <td className="text-primary">{t('rollingStock.constGamma')}</td>
              <td>
                {frs.const_gamma}
                <span className="small ml-1 text-muted">m/s²</span>
              </td>
            </tr>
          )}

          <tr>
            <td className="text-primary">{t('rollingStock.loadingGauge')}</td>
            <td>{rs.loading_gauge}</td>
          </tr>
          <tr>
            <td className="text-primary">{t('rollingStock.basePowerClass')}</td>
            <td>{rs.base_power_class}</td>
          </tr>
        </tbody>
      </table>
    );
  };
  const rightColumn = (rs: LightRollingStockWithLiveries | RollingStockWithLiveries) => {
    const frs = 'startup_time' in rs ? rs : null;

    return (
      <table className="rollingstock-details-table">
        <tbody>
          <tr>
            <td className={cx({ formResistance: form })}>{t('rollingStock.rollingResistance')}</td>
            <td className={cx('text-primary text-muted', { formResistance: form })}>
              {t('rollingStock.rollingResistanceFormula')}
            </td>
          </tr>
          {frs && (
            <tr>
              <td className="text-primary">{t('rollingStock.rollingResistanceA')}</td>
              <td>
                {convertUnits('N', 'kN', frs.rolling_resistance.A, 2)}
                <span className="small ml-1 text-muted">kN</span>
              </td>
            </tr>
          )}
          {frs && (
            <tr>
              <td className="text-primary">{t('rollingStock.rollingResistanceB')}</td>
              <td>
                {/* The b resistance received is in N/(m/s) and should appear in N/(km/h) */}
                {convertUnits('N/(m/s)', 'kN/(km/h)', frs.rolling_resistance.B, 6)}
                <span className="small ml-1 text-muted">kN/(km/h)</span>
              </td>
            </tr>
          )}
          {frs && (
            <tr>
              <td className="text-primary">{t('rollingStock.rollingResistanceC')}</td>
              <td title={frs.rolling_resistance.C.toString()}>
                {/* The c resistance received is in N/(m/s)² and should appear in N/(km/h)² */}
                {convertUnits('N/(m/s)²', 'kN/(km/h)²', frs.rolling_resistance.C, 6)}
                <span className="small ml-1 text-muted">kN/(km/h)²</span>
              </td>
            </tr>
          )}
          {!isEmpty(rs.supported_signaling_systems) && (
            <tr>
              <td className="text-primary text-nowrap pr-1">
                {t('rollingStock.supportedSignalingSystems')}
              </td>
              <td>{rs.supported_signaling_systems.map((s) => s.type).join(', ')}</td>
            </tr>
          )}
          {rs.power_restrictions && Object.keys(rs.power_restrictions).length !== 0 && (
            <tr>
              <td className="text-primary text-nowrap pr-1">
                {t('rollingStock.powerRestrictionsInfos', {
                  count: Object.keys(rs.power_restrictions).length,
                })}
              </td>
              <td>
                {rs.power_restrictions !== null && Object.keys(rs.power_restrictions).join(' ')}
              </td>
            </tr>
          )}
          <tr>
            <td className="text-primary text-nowrap pr-1">{t('rollingStock.primaryCategory')}</td>
            <td> {t(`rollingStock.categoriesOptions.${rs.primary_category}`)} </td>
          </tr>
          {!isEmpty(rs.other_categories) && (
            <tr>
              <td className="text-primary text-nowrap pr-1">{t('rollingStock.otherCategories')}</td>
              <td>
                {rs.other_categories
                  .map((category) => t(`rollingStock.categoriesOptions.${category}`))
                  .toSorted()
                  .join(', ')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    );
  };
  return (
    <div className={form ? 'px-4' : 'rollingstock-card-body'}>
      <div className={`row pt-2 ${form}`}>
        <div className="col-sm-6">{leftColumn(rollingStock)}</div>
        <div className="col-sm-6">{rightColumn(rollingStock)}</div>
      </div>
      {!isEmpty(curvesComfortList) && !hideCurves && fullRollingStock && (
        <>
          <RollingStockCurves
            data={fullRollingStock.effort_curves.modes}
            curvesComfortList={curvesComfortList}
          />
          <div className="rollingstock-detail-container-img">
            <div className="rollingstock-detail-img">
              <RollingStock2Img rollingStock={fullRollingStock} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
