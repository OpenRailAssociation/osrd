import React, { SetStateAction, useState, Dispatch } from 'react';
import { LightRollingStock } from 'common/api/osrdEditoastApi';
import RollingStockCardDetail from 'common/RollingStockSelector/RollingStockCardDetail';
import { RollingStockInfos } from 'common/RollingStockSelector/RollingStockHelpers';
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
    <div className="rollingstock-editor-form w-100 pr-4">
      <div className="rollingstock-header-form">
        <div className="rollingstock-title-form">
          <RollingStockInfos form="-form" data={data} />
        </div>
      </div>
      {isEditing ? (
        <RollingStockEditorForm rollingStockData={data} setIsEditing={setIsEditing} />
      ) : (
        <RollingStockCardDetail
          id={data.id}
          hideCurves
          form="rollingstock-editor-form-text"
          curvesComfortList={curvesComfortList}
          setCurvesComfortList={setCurvesComfortList}
        />
      )}
    </div>
  );
}
