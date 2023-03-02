import React from 'react';

type LineCardProps = {
  resultSearchItem: { [key: string]: string };
  onResultClick: (result: { [key: string]: string }) => void;
};

const LineCard: React.FC<LineCardProps> = ({ resultSearchItem, onResultClick }) => (
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
