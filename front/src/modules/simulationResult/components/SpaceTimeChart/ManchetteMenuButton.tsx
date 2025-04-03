import { useEffect, useRef, useState, memo } from 'react';

import { Eye, KebabHorizontal } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import type { OSRDMenuItem } from 'common/OSRDMenu';
import OSRDMenu from 'common/OSRDMenu';
import useModalFocusTrap from 'utils/hooks/useModalFocusTrap';

type ManchetteMenuButtonProps = {
  setWaypointsPanelIsOpen: (waypointsModalOpen: boolean) => void;
};

const ManchetteMenuButton = ({ setWaypointsPanelIsOpen }: ManchetteMenuButtonProps) => {
  const { t } = useTranslation('simulation');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const closeMenu = () => setIsMenuOpen(false);

  const menuItems: OSRDMenuItem[] = [
    {
      title: t('manchetteSettings.waypointsVisibility'),
      icon: <Eye />,
      onClick: () => {
        closeMenu();
        setWaypointsPanelIsOpen(true);
      },
    },
  ];

  useModalFocusTrap(menuRef, closeMenu, { focusOnFirstElement: true });

  useEffect(() => {
    // TODO : refacto useOutsideClick to accept a list of refs and use the hook here
    const handleClickOutside = (event: MouseEvent) => {
      if (
        !menuRef.current?.contains(event.target as Node) &&
        !menuButtonRef.current?.contains(event.target as Node)
      ) {
        closeMenu();
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  return (
    <>
      <button
        ref={menuButtonRef}
        type="button"
        className={cx('manchette-menu-button', { 'menu-open': isMenuOpen })}
        aria-label={t('toggleManchetteMenu')}
        title={t('toggleManchetteMenu')}
        onClick={() => setIsMenuOpen(!isMenuOpen)}
      >
        <KebabHorizontal />
      </button>
      {isMenuOpen && <OSRDMenu menuRef={menuRef} items={menuItems} />}
    </>
  );
};

export default memo(ManchetteMenuButton);
