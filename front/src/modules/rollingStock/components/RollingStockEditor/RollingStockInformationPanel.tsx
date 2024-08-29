import React, { useState } from 'react';

import cx from 'classnames';

import type { Comfort, RollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import RollingStock2Img from 'modules/rollingStock/components/RollingStock2Img';
import RollingStockCardDetail, {
  getCurvesComforts,
} from 'modules/rollingStock/components/RollingStockCard/RollingStockCardDetail';
import RollingStockCurve from 'modules/rollingStock/components/RollingStockCurve';
import { RollingStockInfo } from 'modules/rollingStock/components/RollingStockSelector/RollingStockHelpers';

type RollingStockInformationPanelProps = {
  id: number;
  isEditing: boolean;
  rollingStock: RollingStockWithLiveries;
};

export default function RollingStockInformationPanel({
  id,
  isEditing,
  rollingStock,
}: RollingStockInformationPanelProps) {
  const [curvesComfortList, setCurvesComfortList] = useState<Comfort[]>([]);

  return (
    <div className={cx('rollingstock-editor-form', { borders: !isEditing })}>
      <div>
        <div className="rollingstock-card-header">
          <div className="rollingstock-title">
            <RollingStockInfo rollingStock={rollingStock} />
          </div>
        </div>
        <RollingStockCardDetail
          id={id}
          hideCurves
          form="rollingstock-editor-form-text"
          curvesComfortList={curvesComfortList}
          setCurvesComfortList={setCurvesComfortList}
        />
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
      </div>
    </div>
  );
}
