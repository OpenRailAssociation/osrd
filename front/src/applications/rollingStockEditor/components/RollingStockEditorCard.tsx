import React, { SetStateAction, useState, Dispatch } from 'react';
import { RollingStock } from 'common/api/osrdEditoastApi';
import RollingStockCardDetail, {
  listCurvesComfort,
} from 'common/RollingStockSelector/RollingStockCardDetail';
import { RollingStockInfo } from 'common/RollingStockSelector/RollingStockHelpers';
import RollingStockCurve from 'common/RollingStockSelector/RollingStockCurves';
import RollingStockEditorForm from './RollingStockEditorForm';
import RollingStockEditorCurves from './RollingStockEditorCurves';

type RollingStockEditorCardProps = {
  isEditing: boolean;
  setIsEditing: Dispatch<SetStateAction<boolean>>;
  rollingStock: RollingStock;
};

export default function RollingStockEditorCard({
  isEditing,
  setIsEditing,
  rollingStock,
}: RollingStockEditorCardProps) {
  const [curvesComfortList, setCurvesComfortList] = useState<string[]>([]);

  return (
    <div className="rollingstock-editor-form w-100 pr-4">
      <div className="rollingstock-header-form" style={{ height: '3rem' }}>
        <div className="rollingstock-title-form">
          <RollingStockInfo form="-form" rollingStock={rollingStock} />
        </div>
      </div>
      {isEditing ? (
        <>
          <RollingStockEditorForm rollingStock={rollingStock} setIsEditing={setIsEditing} />
          <RollingStockEditorCurves data={rollingStock} />
        </>
      ) : (
        <div className="rollingstock-body">
          <RollingStockCardDetail
            id={rollingStock.id}
            hideCurves
            form="rollingstock-editor-form-text"
            curvesComfortList={curvesComfortList}
            setCurvesComfortList={setCurvesComfortList}
          />
          <RollingStockCurve
            curvesComfortList={listCurvesComfort(rollingStock.effort_curves)}
            data={rollingStock.effort_curves.modes}
          />
        </div>
      )}
    </div>
  );
}
