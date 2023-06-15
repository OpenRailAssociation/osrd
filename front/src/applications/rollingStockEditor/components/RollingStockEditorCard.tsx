import React, { SetStateAction, useState, Dispatch } from 'react';
import { LightRollingStock } from 'common/api/osrdEditoastApi';
import RollingStockCardDetail from 'common/RollingStockSelector/RollingStockCardDetail';
import { RollingStockInfo } from 'common/RollingStockSelector/RollingStockHelpers';
import RollingStockEditorForm from './RollingStockEditorForm';

type RollingStockEditorCardProps = {
  isEditing: boolean;
  setIsEditing: Dispatch<SetStateAction<boolean>>;
  data: LightRollingStock;
};

export default function RollingStockEditorCard({
  isEditing,
  setIsEditing,
  data,
}: RollingStockEditorCardProps) {
  const [curvesComfortList, setCurvesComfortList] = useState<string[]>([]);

  return (
    <div className="rollingstock-editor-form w-100">
      {isEditing ? (
        <RollingStockEditorForm rollingStockData={data} setIsEditing={setIsEditing} />
      ) : (
        <>
          <div className="rollingstock-header">
            <div className="rollingstock-title">
              <RollingStockInfo rollingStock={data} />
            </div>
          </div>
          <RollingStockCardDetail
            id={data.id}
            hideCurves
            form="rollingstock-editor-form-text"
            curvesComfortList={curvesComfortList}
            setCurvesComfortList={setCurvesComfortList}
          />
        </>
      )}
    </div>
  );
}
