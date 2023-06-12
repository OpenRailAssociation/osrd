import React, { SetStateAction, useState, Dispatch } from 'react';
import { LightRollingStock } from 'common/api/osrdEditoastApi';
import RollingStockCardDetail from 'common/RollingStockSelector/RollingStockCardDetail';
import { RollingStockInfo } from 'common/RollingStockSelector/RollingStockHelpers';
import RollingStockEditorForm from './RollingStockEditorForm';

type RollingStockEditorCardProps = {
  isEditing: boolean;
  setIsEditing: Dispatch<SetStateAction<boolean>>;
  rollingStock: LightRollingStock;
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
        <RollingStockEditorForm rollingStock={rollingStock} setIsEditing={setIsEditing} />
      ) : (
        <RollingStockCardDetail
          id={rollingStock.id}
          hideCurves
          form="rollingstock-editor-form-text"
          curvesComfortList={curvesComfortList}
          setCurvesComfortList={setCurvesComfortList}
        />
      )}
    </div>
  );
}
