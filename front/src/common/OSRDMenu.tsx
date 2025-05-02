import React from 'react';

import cx from 'classnames';

export type OSRDMenuItem = {
  title: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  disabledMessage?: string;
};

type OSRDMenuProps = {
  menuRef: React.RefObject<HTMLDivElement>;
  items: OSRDMenuItem[];
  className?: string;
};

const OSRDMenu = ({ menuRef, items, className }: OSRDMenuProps) => (
  <div ref={menuRef} className={cx('osrd-menu', className)}>
    {items.map(({ title, icon, disabled, disabledMessage, onClick }) => (
      <button
        disabled={disabled}
        title={disabled ? disabledMessage : undefined}
        key={title}
        type="button"
        className="menu-item"
        onClick={onClick}
      >
        <span className="icon">{icon}</span>
        <span>{title}</span>
      </button>
    ))}
  </div>
);
export default OSRDMenu;
