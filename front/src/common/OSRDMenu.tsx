import React from 'react';

export type OSRDMenuItem = {
  title: string;
  icon: React.ReactNode;
  onClick: () => void;
};

type OSRDMenuProps = {
  menuRef: React.RefObject<HTMLDivElement>;
  items: OSRDMenuItem[];
  style?: React.CSSProperties;
};

const OSRDMenu = ({ menuRef, items, style }: OSRDMenuProps) => (
  <div ref={menuRef} className="osrd-menu" style={style}>
    {items.map(({ title, icon, onClick }) => (
      <button key={title} type="button" className="menu-item" onClick={onClick}>
        <span className="icon">{icon}</span>
        <span>{title}</span>
      </button>
    ))}
  </div>
);
export default OSRDMenu;
