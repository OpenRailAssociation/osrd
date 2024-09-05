import React from 'react';

export type OSRDMenuItem = {
  title: string;
  icon: React.ReactNode;
  onClick: () => void;
};

type OSRDMenuProps = {
  menuRef: React.RefObject<HTMLDivElement>;
  items: OSRDMenuItem[];
};

const OSRDMenu = ({ menuRef, items }: OSRDMenuProps) => (
  <div ref={menuRef} className="osrd-menu">
    {items.map(({ title, icon, onClick }) => (
      <button key={title} type="button" className="menu-item" onClick={onClick}>
        <span className="icon">{icon}</span>
        <span>{title}</span>
      </button>
    ))}
  </div>
);
export default OSRDMenu;
