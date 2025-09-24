import { useRef, useState } from 'react';

import { Eye, KebabHorizontal } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import AnchoredMenu from 'common/AnchoredMenu';
import type { OSRDMenuItem } from 'common/OSRDMenu';
import OSRDMenu from 'common/OSRDMenu';

type ManchetteMenuButtonProps = {
  setWaypointsPanelIsOpen: (waypointsModalOpen: boolean) => void;
};

const ManchetteMenuButton = ({ setWaypointsPanelIsOpen }: ManchetteMenuButtonProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'simulationResults' });
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

  const manchetteMenu = AnchoredMenu({
    children: isMenuOpen && (
      <OSRDMenu menuRef={menuRef} items={menuItems} className="manchette-menu" />
    ),
    anchorRef: menuButtonRef,
    onDismiss: closeMenu,
  });

  return (
    <>
      <button
        ref={menuButtonRef}
        type="button"
        data-testid="manchette-menu-button"
        className={cx('manchette-menu-button', { 'menu-open': isMenuOpen })}
        aria-label={t('toggleManchetteMenu')}
        title={t('toggleManchetteMenu')}
        onClick={() => setIsMenuOpen(!isMenuOpen)}
      >
        <KebabHorizontal />
      </button>
      {manchetteMenu}
    </>
  );
};

export default ManchetteMenuButton;
