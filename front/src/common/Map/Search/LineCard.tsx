import React from 'react';
import { SearchTrackResult } from 'common/api/osrdEditoastApi';

type LineCardProps = {
  resultSearchItem: SearchTrackResult;
  onResultClick: (result: SearchTrackResult) => void;
};

const LineCard = ({ resultSearchItem, onResultClick }: LineCardProps) => (
  <div className="mb-1">
    <div
      className="station-card fixed-height"
      tabIndex={0}
      onClick={() => onResultClick(resultSearchItem)}
      role="button"
    >
      <div className="station-card-head">
        <span className="station-card-name">{resultSearchItem.line_name}</span>
        <span className="station-card-ch">{resultSearchItem.line_code}</span>
      </div>
    </div>
  </div>
);

export default LineCard;
