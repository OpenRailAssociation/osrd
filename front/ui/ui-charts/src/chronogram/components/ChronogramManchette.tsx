import React from 'react';

import { Note, XCircle } from '@osrd-project/ui-icons';

import { GREY_30 } from '../../common/helpers/colors';

export type ChronogramManchetteProps = {
  levelCrossingsNames: string[];
  height: number;
  width?: number;
  onDelete: (name: string) => void;
};

const ChronogramManchette = ({
  levelCrossingsNames,
  height,
  width = 262,
  onDelete,
}: ChronogramManchetteProps) => (
  <div
    className="chronogram-manchette"
    style={{
      height: `${height}px`,
      width: `${width}px`,
    }}
  >
    <div className="chronogram-manchette-header">
      <Note iconColor={GREY_30} />
    </div>
    <div className="chronogram-manchette-list">
      {levelCrossingsNames.map((lcName, index) => (
        <div key={index} className="level-crossing flex justify-between">
          <div className="flex items-center">{lcName}</div>
          <button className="cursor-pointer" onClick={() => onDelete(lcName)}>
            <XCircle className="x-circle" />
          </button>
        </div>
      ))}
    </div>
    <div className="chronogram-manchette-footer"></div>
  </div>
);

export default ChronogramManchette;
