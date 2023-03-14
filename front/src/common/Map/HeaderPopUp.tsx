import React, { ReactNode } from 'react';

type HearderPopUpProps = {
  onClick: () => void;
  title: string;
  isLight?: boolean;
  action?: ReactNode | JSX.Element;
};

const HearderPopUp: React.FC<HearderPopUpProps> = ({ onClick, title, isLight, action }) => (
  <div className="d-flex justify-content-between align-items-start">
    <div className={`h2 ${isLight ? 'text-light' : ''}`}>{title}</div>
    {action && <div>{action}</div>}
    <button type="button" className={`close ${isLight ? 'text-light' : ''}`} onClick={onClick}>
      &times;
    </button>
  </div>
);

export default HearderPopUp;
