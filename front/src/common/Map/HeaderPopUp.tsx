import cx from 'classnames';
import React, { ReactNode } from 'react';

type HearderPopUpProps = {
  onClick: () => void;
  title: string;
  isLight?: boolean;
  action?: ReactNode | JSX.Element;
};

const HearderPopUp: React.FC<HearderPopUpProps> = ({ onClick, title, isLight, action }) => (
  <div className="d-flex justify-content-between align-items-start">
    <div className={cx('h2', { 'text-light': isLight })}>{title}</div>
    {action && <div>{action}</div>}
    <button type="button" className={cx('close', { 'text-light': isLight })} onClick={onClick}>
      &times;
    </button>
  </div>
);

export default HearderPopUp;
