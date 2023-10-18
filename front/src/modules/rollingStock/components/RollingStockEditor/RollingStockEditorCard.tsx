import React, { useState } from 'react';
import { Comfort, RollingStock } from 'common/api/osrdEditoastApi';
import RollingStockCardDetail, {
  listCurvesComfort,
} from 'modules/rollingStock/components/RollingStockSelector/RollingStockCardDetail';
import { RollingStockInfo } from 'modules/rollingStock/components/RollingStockSelector/RollingStockHelpers';
import RollingStockCurve from 'modules/rollingStock/components/RollingStockCurve';
import RollingStock2Img from 'modules/rollingStock/components/RollingStock2Img';

type RollingStockEditorCardProps = {
  id: number;
  isEditing: boolean;
  rollingStock: RollingStock;
};

export default function RollingStockEditorCard({
  id,
  isEditing,
  rollingStock,
}: RollingStockEditorCardProps) {
  const [curvesComfortList, setCurvesComfortList] = useState<Comfort[]>([]);

  return (
    <div className={`rollingstock-editor-form ${!isEditing ? 'borders' : ''} w-100`}>
      <div>
        <div className="rollingstock-header">
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
        <div className="rollingstock-body border-0">
          <RollingStockCurve
            curvesComfortList={listCurvesComfort(rollingStock.effort_curves)}
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
