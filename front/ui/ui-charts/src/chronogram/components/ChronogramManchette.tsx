import React from 'react';

import { INITIAL_HEIGHT } from '../lib/consts';

export type ManchetteProps = {
  contents: string[];
  height?: number;
  width?: number; // in px
};

const ChronogramManchette = ({
  contents,
  height = INITIAL_HEIGHT,
  width = 350,
}: ManchetteProps) => (
  <div className="ui-manchette-container" style={{ width: `${width}px` }}>
    <div
      className="bg-white-100 border-r border-grey-30 relative"
      style={{ height: `${height}px` }}
    >
      <div className="waypoints-list" style={{ width: `${width - 1}px` }}>
        {contents.map((content, index) => (
          <div key={index} className="waypoint-wrapper flex justify-start">
            {content}
          </div>
        ))}
        {/* Ajouter petite croix de suppression du PN */}
      </div>
    </div>
  </div>
);

export default ChronogramManchette;
