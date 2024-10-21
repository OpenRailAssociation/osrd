import React, { useRef, useState } from 'react';

import { EyeClosed } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import type { OperationalPoint } from 'applications/operationalStudies/types';
import type { OSRDMenuItem } from 'common/OSRDMenu';
import useModalFocusTrap from 'utils/hooks/useModalFocusTrap';
import useOutsideClick from 'utils/hooks/useOutsideClick';

const SPACETIME_CHART_HEADER_HEIGHT = 40;
const WAYPOINT_MENU_OFFSET = 2;

const useWaypointMenu = (
  manchetteWrapperRef: React.RefObject<HTMLDivElement>,
  filteredWaypoints?: OperationalPoint[],
  setFilteredWaypoints?: (waypoints: OperationalPoint[]) => void
) => {
  const { t } = useTranslation('simulation');

  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number }>();
  const [activeOperationalPointId, setActiveOperationalPointId] = useState<string>();

  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = () => {
    setMenuPosition(undefined);
    setActiveOperationalPointId(undefined);
  };

  useOutsideClick(menuRef, closeMenu);
  useModalFocusTrap(menuRef, closeMenu);

  const menuItems: OSRDMenuItem[] = [
    {
      title: t('waypointMenu.hide'),
      icon: <EyeClosed />,
      onClick: () => {
        setMenuPosition(undefined);
        setActiveOperationalPointId(undefined);
        if (filteredWaypoints && setFilteredWaypoints) {
          setFilteredWaypoints(
            filteredWaypoints.filter((waypoint) => waypoint.id !== activeOperationalPointId)
          );
        }
      },
    },
  ];

  const handleWaypointClick = (id: string, ref: HTMLDivElement | null) => {
    if (!ref || !manchetteWrapperRef.current) return;
    const position = ref.getBoundingClientRect();
    const manchetteWrapperPosition = manchetteWrapperRef.current.getBoundingClientRect();

    // The position of the clicked waypoint is relative to the viewport so we need to
    // substract the position of the manchetteWrapper to get the accurate position
    setMenuPosition({
      top:
        position.bottom -
        manchetteWrapperPosition.top +
        SPACETIME_CHART_HEADER_HEIGHT -
        WAYPOINT_MENU_OFFSET,
      left: position.left - manchetteWrapperPosition.left,
    });
    setActiveOperationalPointId(id);
  };

  return { menuRef, menuPosition, menuItems, activeOperationalPointId, handleWaypointClick };
};

export default useWaypointMenu;
