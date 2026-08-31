import { useState } from 'react';

import { useTranslation } from 'react-i18next';

import type {
  Comfort,
  RollingStockWithLiveries,
  LightRollingStockWithLiveries,
} from 'common/api/osrdEditoastApi';
import RollingStock2Img from 'modules/rollingStock/components/RollingStock2Img';
import LightRollingStockCardDetail from 'modules/rollingStock/components/RollingStockCard/LightRollingStockCardDetail';
import RollingStockCardDetail, {
  getCurvesComforts,
} from 'modules/rollingStock/components/RollingStockCard/RollingStockCardDetail';
import RollingStockCurve from 'modules/rollingStock/components/RollingStockCurve';
import { RollingStockInfo } from 'modules/rollingStock/components/RollingStockSelector/RollingStockHelpers';

type RollingStockInformationPanelProps = {
  id: number;
  rollingStock: RollingStockWithLiveries | LightRollingStockWithLiveries;
};

export default function RollingStockInformationPanel({
  id,
  rollingStock,
}: RollingStockInformationPanelProps) {
  const [curvesComfortList, setCurvesComfortList] = useState<Comfort[]>([]);
  const { t } = useTranslation();

  const exportRollingStock = () => {
    if (!('inertia_coefficient' in rollingStock))
      throw new Error('Cannot export a rolling stock with only restricted_viewer privileges');
    const { id: _id, locked: _locked, version: _version, ...exportable } = rollingStock;
    const jsonString = JSON.stringify(exportable);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rollingStock-${rollingStock.name}.json`;
    a.click();
  };

  return (
    <div>
      <div className="rollingstock-card-header">
        <div data-testid="rollingstock-title" className="rollingstock-title">
          <RollingStockInfo rollingStock={rollingStock} />
        </div>
      </div>
      {!('inertia_coefficient' in rollingStock) ? (
        <LightRollingStockCardDetail
          form="rollingstock-editor-form-text"
          rollingStock={rollingStock}
        />
      ) : (
        <RollingStockCardDetail
          id={id}
          hideCurves
          form="rollingstock-editor-form-text"
          curvesComfortList={curvesComfortList}
          setCurvesComfortList={setCurvesComfortList}
        />
      )}
      {'inertia_coefficient' in rollingStock && (
        <div className="rollingstock-card-body border-0">
          <RollingStockCurve
            curvesComfortList={getCurvesComforts(rollingStock.effort_curves.modes)}
            data={rollingStock.effort_curves.modes}
          />
          <div className="rollingstock-detail-container-img">
            <div className="rollingstock-detail-img">
              <RollingStock2Img rollingStock={rollingStock} />
            </div>
          </div>
        </div>
      )}
      {'inertia_coefficient' in rollingStock && (
        <div className="d-flex justify-content-end">
          <button
            type="button"
            className="btn btn-primary mt-4"
            aria-label={t('rollingStock.exportRollingStock')}
            title={t('rollingStock.exportRollingStock')}
            onClick={exportRollingStock}
          >
            {t('rollingStock.export')}
          </button>
        </div>
      )}
    </div>
  );
}
