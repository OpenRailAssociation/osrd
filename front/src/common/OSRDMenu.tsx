import React from 'react';

import cx from 'classnames';

export type OSRDMenuItem = {
  title: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  disabledMessage?: string;
  dataTestID?: string;
};

type OSRDMenuProps = {
  menuRef: React.RefObject<HTMLDivElement | null>;
  items: OSRDMenuItem[];
  className?: string;
};

const OSRDMenu = ({ menuRef, items, className }: OSRDMenuProps) => (
  <div ref={menuRef} className={cx('osrd-menu', className)}>
    {items.map(({ title, icon, disabled, disabledMessage, onClick, dataTestID }) => (
      <button
        disabled={disabled}
        title={disabled ? disabledMessage : undefined}
        key={title}
        type="button"
        className="menu-item"
        onClick={onClick}
        data-testid={dataTestID}
      >
        <span className="icon">{icon}</span>
        <span>{title}</span>
      </button>
    ))}
  </div>
);
export default OSRDMenu;
