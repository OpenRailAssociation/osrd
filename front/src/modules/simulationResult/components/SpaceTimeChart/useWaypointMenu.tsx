import { useEffect, useRef, useState } from 'react';

import { EyeClosed } from '@osrd-project/ui-icons';
import { omit } from 'lodash';
import { useTranslation } from 'react-i18next';

import type { OSRDMenuItem } from 'common/OSRDMenu';
import type { WaypointsPanelData } from 'modules/simulationResult/types';
import useModalFocusTrap from 'utils/hooks/useModalFocusTrap';

const useWaypointMenu = (waypointsPanelData?: WaypointsPanelData) => {
  const { filteredWaypoints, setFilteredWaypoints, projectionPath, timetableId } =
    waypointsPanelData || {};
  const { t } = useTranslation('simulation');

  const [activeWaypointId, setActiveWaypointId] = useState<string>();

  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = () => {
    setActiveWaypointId(undefined);
  };

  useModalFocusTrap(menuRef, closeMenu, { focusOnFirstElement: true });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Close the menu if the user clicks outside of it
      if (!menuRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    };

    if (activeWaypointId) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeWaypointId]);

  const menuItems: OSRDMenuItem[] = [
    {
      title: t('waypointMenu.hide'),
      icon: <EyeClosed />,
      disabled: filteredWaypoints ? filteredWaypoints.length <= 2 : false,
      disabledMessage: t('waypointsPanel.warning'),
      onClick: () => {
        closeMenu();
        setFilteredWaypoints?.((prevFilteredWaypoints) => {
          const newFilteredWaypoints = prevFilteredWaypoints.filter(
            (waypoint) => waypoint.id !== activeWaypointId
          );

          // We need to remove the id because it can change for waypoints added by map click
          const simplifiedPath = projectionPath?.map((waypoint) =>
            omit(waypoint, ['id', 'deleted'])
          );

          // TODO : when switching to the manchette back-end manager, remove all logic using
          // cleanScenarioLocalStorage from projet/study/scenario components (single/multi select)
          localStorage.setItem(
            `${timetableId}-${JSON.stringify(simplifiedPath)}`,
            JSON.stringify(newFilteredWaypoints)
          );
          return newFilteredWaypoints;
        });
      },
    },
  ];

  const handleWaypointClick = (id: string) => {
    setActiveWaypointId(id);
  };

  return { menuRef, menuItems, activeWaypointId, handleWaypointClick };
};

export default useWaypointMenu;
