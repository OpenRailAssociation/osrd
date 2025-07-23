import React, { useRef, useState } from 'react';

import { KebabHorizontal } from '@osrd-project/ui-icons';
import cx from 'classnames';

import AnchoredMenu from './AnchoredMenu';
import type { OSRDMenuItem } from './OSRDMenu';
import OSRDMenu from './OSRDMenu';

export type ButtonProps = {
  icon?: React.ReactNode;
  dataTestID?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export type MenuProps = {
  items: OSRDMenuItem[];
  className?: string;
  onMenuClose?: () => void;
  onMenuOpen?: () => void;
};

export type MenuTriggerButtonProps = {
  buttonProps: ButtonProps;
  menuProps: MenuProps;
};

const MenuTriggerButton = ({ buttonProps, menuProps }: MenuTriggerButtonProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const { items, className: menuClassName, onMenuClose, onMenuOpen } = menuProps;
  const {
    icon = <KebabHorizontal />,
    onClick,
    className: buttonClassName = '',
    dataTestID,
    ...restButtonProps
  } = buttonProps;

  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const closeMenu = () => {
    setIsMenuOpen(false);
    onMenuClose?.();
  };

  const openMenu = () => {
    setIsMenuOpen(true);
    onMenuOpen?.();
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isMenuOpen) {
      closeMenu();
    } else {
      openMenu();
    }

    onClick?.(e);
  };

  const menu = AnchoredMenu({
    children: isMenuOpen && (
      <OSRDMenu
        menuRef={menuRef}
        items={items.map((item) => ({
          ...item,
          onClick: () => {
            item.onClick();
            closeMenu();
          },
        }))}
        className={menuClassName}
      />
    ),
    anchorRef: menuButtonRef,
    onDismiss: closeMenu,
  });

  return (
    <>
      <button
        ref={menuButtonRef}
        type="button"
        onClick={handleClick}
        className={cx(buttonClassName, { 'menu-is-opened': isMenuOpen })}
        data-testid={dataTestID}
        {...restButtonProps}
      >
        {icon}
      </button>
      {menu}
    </>
  );
};

export default MenuTriggerButton;
