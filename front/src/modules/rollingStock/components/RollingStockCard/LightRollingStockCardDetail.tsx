import { isEmpty } from 'lodash';
import { useTranslation } from 'react-i18next';

import type { LightRollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import { Loader } from 'common/Loaders/Loader';

type RollingStockCardDetailProps = {
  form?: string;
  rollingStock: LightRollingStockWithLiveries;
};

export default function LightRollingStockCardDetail({
  form,
  rollingStock,
}: RollingStockCardDetailProps) {
  const { t } = useTranslation();

  if (!rollingStock) {
    return (
      <div className="rollingstock-card-body">
        <Loader />
      </div>
    );
  }

  const leftColumn = (rs: LightRollingStockWithLiveries) => (
    <table className="rollingstock-details-table">
      <tbody>
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
  const rightColumn = (rs: LightRollingStockWithLiveries) => (
    <table className="rollingstock-details-table">
      <tbody>
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
  return (
    <div className={form ? 'px-4' : 'rollingstock-card-body'}>
      <div className={`row pt-2 ${form}`}>
        <div className="col-sm-6">{leftColumn(rollingStock)}</div>
        <div className="col-sm-6">{rightColumn(rollingStock)}</div>
      </div>
    </div>
  );
}
