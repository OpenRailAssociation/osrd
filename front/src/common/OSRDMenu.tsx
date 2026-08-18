import React from 'react';

import cx from 'classnames';

export type OSRDMenuItem = {
  title: string;
  icon: React.ReactNode;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  disabled?: boolean;
  disabledMessage?: string;
  dataTestID?: string;
  className?: string;
};

type OSRDMenuProps = {
  menuRef?: React.RefObject<HTMLDivElement | null>;
  items: OSRDMenuItem[];
  className?: string;
};

const OSRDMenu = ({ menuRef, items, className }: OSRDMenuProps) => (
  <div ref={menuRef} className={cx('osrd-menu', className)}>
    {items.map(
      ({
        title,
        icon,
        disabled,
        disabledMessage,
        onClick,
        onMouseEnter,
        onMouseLeave,
        dataTestID,
        className: itemClassName,
      }) => (
        <button
          key={title}
          disabled={disabled}
          title={disabled ? disabledMessage : undefined}
          type="button"
          className={cx('menu-item', itemClassName)}
          onClick={onClick}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          data-testid={dataTestID}
        >
          <span className="icon">{icon}</span>
          <span>{title}</span>
        </button>
      )
    )}
  </div>
);
export default OSRDMenu;
