import React from 'react';

import MenuButton from 'common/MenuButton';
import type { OSRDMenuItem } from 'common/OSRDMenu';

type BoardWrapperProps = {
  children: React.ReactNode;
  visible: boolean;
  name: string;
  items?: OSRDMenuItem[];
};

const BoardWrapper = ({ children, visible, name, items = [] }: BoardWrapperProps) => {
  if (!visible) {
    return null;
  }

  return (
    <div className="board-wrapper">
      <div className="board-header">
        <span className="board-header-name">{name}</span>
        <MenuButton
          buttonProps={{
            className: 'board-header-button',
          }}
          menuProps={{ items }}
        />
      </div>
      <div className="board-body">{children}</div>
    </div>
  );
};

export default BoardWrapper;
