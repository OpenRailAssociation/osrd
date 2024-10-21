import { useRef, useState } from 'react';

import { EyeClosed } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import type { OperationalPoint } from 'applications/operationalStudies/types';
import type { OSRDMenuItem } from 'common/OSRDMenu';
import useOutsideClick from 'utils/hooks/useOutsideClick';

const useWaypointMenu = (
  filteredWaypoints?: OperationalPoint[],
  setFilteredWaypoints?: (waypoints: OperationalPoint[]) => void
) => {
  const { t } = useTranslation('simulation');

  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number }>();
  const [activeOperationalPointId, setActiveOperationalPointId] = useState<string>();

  const menuRef = useRef<HTMLDivElement>(null);

  useOutsideClick(menuRef, () => {
    setMenuPosition(undefined);
    setActiveOperationalPointId(undefined);
  });

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
    if (!ref) return;
    const position = ref.getBoundingClientRect();
    console.log({ position });
    // fix position issue
    setMenuPosition({ top: position.bottom - 2, left: position.left });
    setActiveOperationalPointId(id);
  };

  return { menuRef, menuPosition, menuItems, activeOperationalPointId, handleWaypointClick };
};

export default useWaypointMenu;
