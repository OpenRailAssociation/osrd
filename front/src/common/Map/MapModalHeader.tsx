import cx from 'classnames';
import React from 'react';

type MapModalHeaderProps = {
  closeAction: () => void;
  title: string;
  textLight?: boolean;
};

const MapModalHeader: React.FC<MapModalHeaderProps> = ({ closeAction, title, textLight }) => (
  <div className="d-flex justify-content-between align-items-start">
    <div className={cx('h2', { 'text-light': textLight })}>{title}</div>
    <button
      type="button"
      className={cx('close', { 'text-light': textLight })}
      onClick={closeAction}
      data-testid="close-modal"
    >
      &times;
    </button>
  </div>
);

export default MapModalHeader;
