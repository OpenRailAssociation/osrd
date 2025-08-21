import { type RefObject, useEffect, useRef, useState } from 'react';

import { EyeClosed, Fold, Unfold } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import AnchoredMenu from 'common/AnchoredMenu';
import type { OSRDMenuItem } from 'common/OSRDMenu';
import OSRDMenu from 'common/OSRDMenu';
import type { WaypointsPanelData } from 'modules/simulationResult/types';
import useModalFocusTrap from 'utils/hooks/useModalFocusTrap';

import { getWaypointsLocalStorageKey } from './helpers/utils';

const useWaypointMenu = (
  activeWaypointRef: RefObject<HTMLDivElement | null>,
  waypointsPanelData?: WaypointsPanelData,
  allTrainsProjected?: boolean
) => {
  const {
    filteredWaypoints,
    setFilteredWaypoints,
    projectionPath,
    timetableId,
    deployedWaypoints,
    toggleDeployedWaypoint,
  } = waypointsPanelData || {};
  const { t } = useTranslation('operational-studies');

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
      title: t('simulationResults.waypointMenu.hide'),
      icon: <EyeClosed />,
      disabled: filteredWaypoints ? filteredWaypoints.length <= 2 : false,
      disabledMessage: t('simulationResults.waypointsPanel.warning'),
      onClick: () => {
        closeMenu();
        setFilteredWaypoints?.((prevFilteredWaypoints) => {
          const newFilteredWaypoints = prevFilteredWaypoints.filter(
            (waypoint) => waypoint.waypointId !== activeWaypointId
          );

          // TODO : when switching to the manchette back-end manager, remove all logic using
          // cleanScenarioLocalStorage from projet/study/scenario components (single/multi select)
          localStorage.setItem(
            getWaypointsLocalStorageKey(timetableId, projectionPath),
            JSON.stringify(newFilteredWaypoints)
          );
          return newFilteredWaypoints;
        });

        // Hide the tracks occupancy diagram if it is deployed now:
        if (
          !!activeWaypointId &&
          deployedWaypoints?.has(activeWaypointId) &&
          toggleDeployedWaypoint
        )
          toggleDeployedWaypoint(activeWaypointId, false);
      },
    },
  ];

  if (deployedWaypoints && toggleDeployedWaypoint && typeof activeWaypointId === 'string') {
    const activeWaypoint = filteredWaypoints?.find(
      (waypoint) => waypoint.waypointId === activeWaypointId
    );

    if (typeof activeWaypoint?.opId === 'string') {
      const isDeployed = deployedWaypoints.has(activeWaypointId);

      menuItems.push({
        disabled: !isDeployed && !allTrainsProjected,
        title: isDeployed
          ? t('simulationResults.waypointMenu.hideOccupancy')
          : t('simulationResults.waypointMenu.showOccupancy'),
        icon: isDeployed ? <Fold /> : <Unfold />,
        onClick: () => {
          closeMenu();
          toggleDeployedWaypoint?.(activeWaypointId, !isDeployed);
        },
      });
    }
  }

  const waypointMenu = AnchoredMenu({
    children: activeWaypointId && (
      <OSRDMenu menuRef={menuRef} items={menuItems} className="waypoint-menu" />
    ),
    anchorRef: activeWaypointRef,
    onDismiss: closeMenu,
  });

  const handleWaypointClick = (id: string) => {
    setActiveWaypointId(id);
  };

  return { activeWaypointId, handleWaypointClick, waypointMenu };
};

export default useWaypointMenu;
