import React from 'react';

import { Note, XCircle } from '@osrd-project/ui-icons';

import { INITIAL_HEIGHT } from '../lib/consts';

export type ManchetteProps = {
  contents: string[];
  height?: number;
  width?: number; // in px
};

const ChronogramManchette = ({
  contents,
  height = INITIAL_HEIGHT,
  width = 262,
}: ManchetteProps) => (
  <div
    className="chronogram-manchette"
    style={{
      height: `${height}px`,
      width: `${width - 1}px`,
    }}
  >
    <div className="chronogram-manchette-header">
      <Note iconColor={'rgba(148,145,142,1)'} />
    </div>
    {contents.map((content, index) => (
      <div key={index} className="level-crossing flex justify-between items-center">
        <div className="flex items-center">{content}</div>
        <button className="cursor-pointer">
          <XCircle iconColor={'rgba(148,145,142,1)'} />
        </button>
      </div>
    ))}
  </div>
);

export default ChronogramManchette;
