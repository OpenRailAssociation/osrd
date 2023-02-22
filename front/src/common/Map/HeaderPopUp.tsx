import React from 'react';

type HearderPopUpProps = {
  onClick: () => void;
  title: string;
  isLight?: boolean;
};

const HearderPopUp: React.FC<HearderPopUpProps> = ({ onClick, title, isLight }) => (
  <div className="d-flex justify-content-between align-items-start">
    <div className={`h2 ${isLight ? 'text-light' : ''}`}>{title}</div>
    <button type="button" className={`close ${isLight ? 'text-light' : ''}`} onClick={onClick}>
      &times;
    </button>
  </div>
);

export default HearderPopUp;
